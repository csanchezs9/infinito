const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const shopifyService = require('./shopify-service');
const { organizarColeccionesPorCategoria, obtenerNombreColeccion } = require('./categorias-config');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
let PORT = 3000;

// Caché simple para colecciones (15 minutos)
let cacheColecciones = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

// Sistema de heartbeat para cerrar el servidor cuando se cierra el navegador
let ultimoHeartbeat = null; // null = aún no se ha conectado ningún cliente
let clienteConectado = false;
const HEARTBEAT_TIMEOUT = 3000; // 3 segundos sin heartbeat = cerrar servidor

// Verificar cada 500ms si el navegador sigue activo (muy agresivo)
const heartbeatInterval = setInterval(() => {
    // Solo verificar si ya hubo al menos un cliente conectado
    if (clienteConectado && ultimoHeartbeat) {
        const tiempoSinHeartbeat = Date.now() - ultimoHeartbeat;
        if (tiempoSinHeartbeat > HEARTBEAT_TIMEOUT) {
            console.log('\n⚠️  Navegador cerrado - Deteniendo servidor automáticamente...\n');
            clearInterval(heartbeatInterval);
            process.exit(0);
        }
    }
}, 500);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint para recibir heartbeat del navegador
app.post('/api/heartbeat', (req, res) => {
    if (!clienteConectado) {
        clienteConectado = true;
        console.log('✅ Cliente conectado - Sistema de cierre automático activado');
    }
    ultimoHeartbeat = Date.now();
    res.json({ ok: true });
});

// Endpoint para cerrar el servidor cuando se cierra la pestaña del navegador
app.post('/api/shutdown', (req, res) => {
    console.log('\n🛑 Navegador cerrado - Deteniendo servidor...\n');
    res.json({ ok: true });

    // Cierre inmediato (100ms para que llegue la respuesta)
    setTimeout(() => {
        clearInterval(heartbeatInterval);
        process.exit(0);
    }, 100);
});

// Endpoint para obtener todas las colecciones organizadas por categoría
app.get('/api/colecciones', async (req, res) => {
    try {
        const ahora = Date.now();
        const forceRefresh = req.query.refresh === 'true';

        // Verificar si el caché es válido (excepto si se fuerza refresh)
        if (!forceRefresh && cacheColecciones && cacheTimestamp && (ahora - cacheTimestamp) < CACHE_DURATION) {
            return res.json(cacheColecciones);
        }

        if (forceRefresh) {
            console.log('🔄 Forzando actualización de productos desde Shopify...');
        }

        // Obtener TODAS las colecciones definidas en categorias-config
        const { CATEGORIAS } = require('./categorias-config');
        const todasLasColeccionesDefinidas = new Set();

        // Recopilar todas las colecciones definidas en todas las categorías
        for (const categoria of Object.values(CATEGORIAS)) {
            categoria.colecciones.forEach(handle => todasLasColeccionesDefinidas.add(handle));
        }

        const coleccionesFormateadas = [];

        // Verificar cada colección obteniendo sus productos REALES (en paralelo para mayor velocidad)
        const promesas = Array.from(todasLasColeccionesDefinidas).map(async (handle) => {
            try {
                const productos = await shopifyService.obtenerProductosPorColeccion(handle);
                if (productos.length > 0) {
                    return {
                        handle: handle,
                        title: obtenerNombreColeccion(handle, handle),
                        productCount: productos.length,
                        description: ''
                    };
                }
            } catch (error) {
                // Omitir colecciones con errores
            }
            return null;
        });

        const resultados = await Promise.all(promesas);
        coleccionesFormateadas.push(...resultados.filter(r => r !== null));

        // Organizar por categorías
        const coleccionesPorCategoria = organizarColeccionesPorCategoria(coleccionesFormateadas);

        // Guardar en caché con fecha de actualización
        cacheColecciones = {
            categorias: coleccionesPorCategoria,
            fechaActualizacion: new Date().toISOString()
        };
        cacheTimestamp = ahora;

        res.json({
            categorias: coleccionesPorCategoria,
            fechaActualizacion: cacheColecciones.fechaActualizacion
        });
    } catch (error) {
        console.error('Error obteniendo colecciones:', error);
        res.status(500).json({ error: 'Error obteniendo colecciones de la tienda' });
    }
});

// Endpoint para generar el PDF - ahora con colección dinámica
app.get('/api/generar-catalogo', async (req, res) => {
    try {
        const coleccion = req.query.coleccion || 'nariz'; // Default: nariz


        // Obtener productos desde Shopify API
        const productos = await shopifyService.obtenerProductosParaCatalogo(coleccion);

        if (productos.length === 0) {
            return res.status(404).json({
                error: `No se encontraron productos en la colección '${coleccion}'`
            });
        }

        // Obtener info de la colección
        const infoColeccion = await shopifyService.obtenerInfoColeccion(coleccion);
        const nombreColeccion = infoColeccion?.title || coleccion.toUpperCase();

        // Generar HTML
        const html = await generarHTML(productos, nombreColeccion);

        // Generar PDF con Puppeteer
        // Configurar ruta de Chrome (portable o sistema)
        const path = require('path');
        const fs = require('fs');
        const launchOptions = {
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        // Si existe Chrome portable en la carpeta, usarlo
        const chromePortablePath = path.join(process.cwd(), 'chrome', 'chrome.exe');
        if (fs.existsSync(chromePortablePath)) {
            launchOptions.executablePath = chromePortablePath;
            console.log('📦 Usando Chrome portable');
        } else if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log('📦 Usando Chrome de variable de entorno');
        }

        const browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();

        // Sin límite de timeout - esperar todo el tiempo necesario (hasta 10 minutos)
        page.setDefaultNavigationTimeout(600000); // 10 minutos
        page.setDefaultTimeout(600000); // 10 minutos

        console.log('⏳ Cargando contenido HTML y esperando TODAS las imágenes...');
        console.log('   (Esto puede tomar varios minutos con catálogos grandes)');

        // Usar 'networkidle0' para esperar a que TODAS las imágenes carguen
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 600000 // 10 minutos máximo
        });

        console.log('✅ Todas las imágenes cargadas. Generando PDF...');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            }
        });

        await browser.close();

        // Enviar PDF
        const filename = `catalogo-infinito-${coleccion}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Error generando PDF:', error);
        res.status(500).json({
            error: 'Error generando el catálogo PDF',
            details: error.message
        });
    }
});

// Endpoint de health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servicio de catálogo PDF funcionando' });
});

// Función para generar el HTML del catálogo
async function generarHTML(productos, nombreColeccion = 'PRODUCTOS') {
    // Dividir productos en grupos para paginación más creativa
    const productosPorPagina = 4; // Grid 2x2 - Productos más grandes
    const paginas = [];

    for (let i = 0; i < productos.length; i += productosPorPagina) {
        paginas.push(productos.slice(i, i + productosPorPagina));
    }

    const paginasHTML = paginas.map((productosGrupo, indexPagina) => {
        const esParImpar = indexPagina % 2 === 0;

        return `
        <div class="page ${esParImpar ? 'page-even' : 'page-odd'}">
            <!-- Header decorativo -->
            <div class="page-header">
                <div class="header-pattern"></div>
                <div class="header-content">
                    <div class="brand-section">
                        <div class="infinity-symbol">∞</div>
                        <h1 class="brand-name">INFINITO PIERCING</h1>
                    </div>
                    <div class="collection-badge">COLECCIÓN ${nombreColeccion.toUpperCase()}</div>
                </div>
                <div class="header-accent"></div>
            </div>

            <!-- Grid de productos -->
            <div class="products-grid">
                ${productosGrupo.map((producto, idx) => `
                    <div class="product-card" style="animation-delay: ${idx * 0.1}s">
                        <div class="product-image-wrapper">
                            <div class="image-frame">
                                <img src="${producto.imagen}" alt="${producto.nombre}" class="product-image">
                            </div>
                            <div class="geometric-accent"></div>
                        </div>
                        <div class="product-info">
                            <h3 class="product-name">${producto.nombre}</h3>
                            <div class="price-tag">
                                <span class="price">${producto.precio}</span>
                                ${producto.disponible ? '<span class="stock-badge">En Stock</span>' : '<span class="stock-badge agotado-badge">Agotado</span>'}
                            </div>
                        </div>
                        <div class="product-number">${String(indexPagina * productosPorPagina + idx + 1).padStart(2, '0')}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Footer con número de página -->
            <div class="page-footer">
                <div class="footer-accent"></div>
                <div class="page-number">
                    <span class="numero">${indexPagina + 1}</span>
                    <span class="total">/ ${paginas.length}</span>
                </div>
                <div class="footer-info">
                    <span>infinitopiercing.com</span>
                    <span class="separator">•</span>
                    <span>Catálogo 2025</span>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Página de portada
    const portada = `
    <div class="page cover-page">
        <div class="cover-background">
            <div class="cover-pattern"></div>
        </div>

        <div class="cover-content">
            <div class="cover-header">
                <div class="infinity-large">∞</div>
                <h1 class="cover-title">
                    <span class="title-main">INFINITO</span>
                    <span class="title-sub">PIERCING</span>
                </h1>
            </div>

            <div class="cover-middle">
                <div class="collection-title">
                    <div class="collection-line"></div>
                    <h2>COLECCIÓN ${nombreColeccion.toUpperCase()}</h2>
                    <div class="collection-line"></div>
                </div>
                <div class="collection-stats">
                    <div class="stat-item">
                        <div class="stat-number">${productos.length}</div>
                        <div class="stat-label">Productos</div>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <div class="stat-number">2025</div>
                        <div class="stat-label">Catálogo</div>
                    </div>
                </div>
            </div>

            <div class="cover-footer">
                <p class="tagline">Joyería de alta calidad para tus perforaciones</p>
                <p class="website">infinitopiercing.com</p>
            </div>
        </div>
    </div>
    `;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Catálogo Infinito Piercing - ${nombreColeccion}</title>
        <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=Bebas+Neue&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            :root {
                --color-dark: #121212;
                --color-accent: #afb744;
                --color-white: #FFFFFF;
                --color-gray: #F5F5F5;
                --color-gray-mid: #999999;
                --color-gray-dark: #333333;
                --color-border: #e5e5e5;
            }

            body {
                font-family: 'Assistant', sans-serif;
                color: var(--color-dark);
                background: white;
            }

            /* PÁGINA */
            .page {
                width: 210mm;
                height: 297mm;
                position: relative;
                page-break-after: always;
                background: white;
                overflow: hidden;
            }

            /* PORTADA */
            .cover-page {
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .cover-background {
                position: absolute;
                inset: 0;
                overflow: hidden;
            }

            .cover-pattern {
                position: absolute;
                inset: 0;
                background:
                    repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(18, 18, 18, 0.02) 35px, rgba(18, 18, 18, 0.02) 70px),
                    repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(18, 18, 18, 0.02) 35px, rgba(18, 18, 18, 0.02) 70px);
            }

            .cover-content {
                position: relative;
                z-index: 2;
                text-align: center;
                padding: 60px;
                max-width: 600px;
            }

            .infinity-large {
                font-size: 120px;
                color: var(--color-dark);
                font-weight: 300;
                line-height: 1;
                margin-bottom: 20px;
            }

            .cover-title {
                margin-bottom: 80px;
            }

            .title-main {
                display: block;
                font-family: 'Bebas Neue', sans-serif;
                font-size: 72px;
                letter-spacing: 12px;
                color: var(--color-dark);
                font-weight: 400;
                line-height: 1;
            }

            .title-sub {
                display: block;
                font-family: 'Bebas Neue', sans-serif;
                font-size: 48px;
                letter-spacing: 18px;
                color: var(--color-gray-dark);
                font-weight: 400;
                margin-top: 5px;
            }

            .cover-middle {
                margin: 80px 0;
            }

            .collection-title {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 20px;
                margin-bottom: 50px;
            }

            .collection-line {
                width: 80px;
                height: 2px;
                background: linear-gradient(90deg, transparent, var(--color-dark), transparent);
            }

            .collection-title h2 {
                font-size: 32px;
                letter-spacing: 6px;
                color: var(--color-dark);
                font-weight: 300;
            }

            .collection-stats {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 40px;
            }

            .stat-item {
                text-align: center;
            }

            .stat-number {
                font-size: 56px;
                font-weight: 800;
                color: var(--color-dark);
                line-height: 1;
                margin-bottom: 8px;
            }

            .stat-label {
                font-size: 14px;
                letter-spacing: 2px;
                color: var(--color-gray-mid);
                text-transform: uppercase;
            }

            .stat-divider {
                width: 2px;
                height: 60px;
                background: linear-gradient(180deg, transparent, rgba(18, 18, 18, 0.2), transparent);
            }

            .cover-footer {
                margin-top: 80px;
            }

            .tagline {
                font-size: 16px;
                color: var(--color-gray-dark);
                margin-bottom: 15px;
                font-weight: 300;
            }

            .website {
                font-size: 14px;
                color: var(--color-dark);
                letter-spacing: 2px;
                font-weight: 600;
            }

            /* PÁGINAS INTERNAS */
            .page-even {
                background: linear-gradient(to bottom right, #ffffff 0%, #fafafa 100%);
            }

            .page-odd {
                background: linear-gradient(to bottom left, #ffffff 0%, #f8f8f8 100%);
            }

            /* HEADER */
            .page-header {
                position: relative;
                padding: 12px 30px;
                background: var(--color-white);
                border-bottom: 2px solid var(--color-dark);
            }

            .header-pattern {
                position: absolute;
                inset: 0;
                background: transparent;
            }

            .header-content {
                position: relative;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .brand-section {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .infinity-symbol {
                font-size: 30px;
                color: var(--color-dark);
                font-weight: 300;
            }

            .brand-name {
                font-family: 'Bebas Neue', sans-serif;
                font-size: 24px;
                letter-spacing: 3px;
                color: var(--color-dark);
                font-weight: 400;
            }

            .collection-badge {
                background: var(--color-dark);
                color: var(--color-white);
                padding: 6px 16px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 2px;
                border-radius: 18px;
            }

            .header-accent {
                display: none;
            }

            /* GRID DE PRODUCTOS */
            .products-grid {
                padding: 15px 35px 5px 35px;
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
                gap: 20px;
                height: 240mm;
            }

            .product-card {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                position: relative;
                transition: transform 0.3s ease;
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            .product-image-wrapper {
                position: relative;
                background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
                flex: 1;
                min-height: 0;
                display: flex;
                align-items: center;
            }

            .image-frame {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 35px;
            }

            .product-image {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }

            .geometric-accent {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 30px;
                height: 30px;
                border: 2px solid var(--color-dark);
                border-radius: 50%;
                opacity: 0.15;
            }

            .product-info {
                padding: 20px 25px;
                flex-shrink: 0;
            }

            .product-name {
                font-size: 18px;
                font-weight: 700;
                color: var(--color-dark);
                margin-bottom: 15px;
                line-height: 1.4;
                min-height: 52px;
                letter-spacing: 0.5px;
            }

            .price-tag {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .price {
                font-size: 22px;
                font-weight: 800;
                color: var(--color-dark);
            }

            .stock-badge {
                font-size: 11px;
                color: var(--color-dark);
                font-weight: 700;
                background: var(--color-gray);
                padding: 5px 12px;
                border-radius: 10px;
                letter-spacing: 0.5px;
                border: 1px solid var(--color-border);
            }

            .agotado-badge {
                background: var(--color-dark);
                color: var(--color-white);
                border: 1px solid var(--color-dark);
            }

            .product-number {
                position: absolute;
                top: 15px;
                left: 15px;
                background: var(--color-dark);
                color: var(--color-white);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            /* FOOTER */
            .page-footer {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 8px 35px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(to top, rgba(18, 18, 18, 0.03), transparent);
            }

            .footer-accent {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: var(--color-border);
            }

            .page-number {
                font-size: 18px;
                font-weight: 700;
                color: var(--color-dark);
            }

            .page-number .numero {
                color: var(--color-dark);
                font-size: 24px;
            }

            .page-number .total {
                color: var(--color-gray-mid);
                font-size: 14px;
                margin-left: 4px;
            }

            .footer-info {
                font-size: 11px;
                color: var(--color-gray-mid);
                letter-spacing: 1px;
            }

            .separator {
                margin: 0 8px;
                color: var(--color-gray-mid);
            }
        </style>
    </head>
    <body>
        ${portada}
        ${paginasHTML}
    </body>
    </html>
    `;
}

// Función para matar procesos en un puerto específico (Windows)
async function killProcessOnPort(port) {
    try {
        // Buscar el PID que usa el puerto
        const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
        const lines = stdout.split('\n');

        for (const line of lines) {
            // Buscar líneas que contengan LISTENING
            if (line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];

                if (pid && pid !== '0') {
                    console.log(`🔍 Encontrado proceso en puerto ${port} (PID: ${pid})`);

                    // Intentar matar el proceso
                    try {
                        await execPromise(`taskkill /F /PID ${pid}`);
                        console.log(`✅ Proceso ${pid} cerrado exitosamente`);
                        // Esperar un momento para que se libere el puerto
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return true;
                    } catch (killError) {
                        console.log(`⚠️  No se pudo cerrar el proceso ${pid}`);
                    }
                }
            }
        }
    } catch (error) {
        // No hay proceso en el puerto o error al buscar
    }
    return false;
}

// Función para verificar si un puerto está disponible
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();

        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        server.listen(port, '0.0.0.0');
    });
}

// Función para encontrar un puerto disponible
async function findAvailablePort(startPort, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        console.log(`🔍 Verificando puerto ${port}...`);

        const available = await isPortAvailable(port);
        if (available) {
            console.log(`✅ Puerto ${port} está disponible`);
            return port;
        } else {
            console.log(`⚠️  Puerto ${port} está ocupado`);

            // Intentar matar el proceso en el primer intento (puerto preferido)
            if (i === 0) {
                console.log(`🔧 Intentando cerrar procesos anteriores en puerto ${port}...`);
                const killed = await killProcessOnPort(port);
                if (killed) {
                    // Verificar de nuevo si está disponible
                    const nowAvailable = await isPortAvailable(port);
                    if (nowAvailable) {
                        console.log(`✅ Puerto ${port} liberado y disponible`);
                        return port;
                    }
                }
            }
        }
    }

    throw new Error(`No se pudo encontrar un puerto disponible después de ${maxAttempts} intentos`);
}

// Iniciar el servidor con manejo robusto de puertos
async function startServer() {
    try {
        // Buscar puerto disponible
        PORT = await findAvailablePort(3000, 5);

        app.listen(PORT, async () => {
            console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     ∞  INFINITO PIERCING - SERVICIO DE CATÁLOGO PDF       ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝

    🚀 Servidor corriendo en: http://localhost:${PORT}

    📍 Endpoints disponibles:
       GET  /api/generar-catalogo  - Generar y descargar PDF
       GET  /api/colecciones        - Obtener colecciones disponibles
       GET  /api/health             - Health check

    ✨ Listo para generar catálogos creativos!

    🌐 Abriendo navegador...

    ⚠️  IMPORTANTE: Para detener el servidor, presiona Ctrl+C
    `);

            // Abrir el navegador automáticamente usando comando nativo de Windows
            try {
                exec(`start http://localhost:${PORT}`);
            } catch (error) {
                console.error('No se pudo abrir el navegador automáticamente:', error.message);
                console.log('👉 Abre manualmente: http://localhost:' + PORT);
            }
        });
    } catch (error) {
        console.error(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     ❌ ERROR: No se pudo iniciar el servidor               ║
    ║                                                            ║
    ║     ${error.message.padEnd(56)}║
    ║                                                            ║
    ║     Por favor, cierra otras aplicaciones que puedan       ║
    ║     estar usando los puertos 3000-3004 e intenta de nuevo ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
        `);
        process.exit(1);
    }
}

// Iniciar el servidor
startServer();

// Código antiguo comentado - ahora se usa startServer()
/*
app.listen(PORT, async () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     ∞  INFINITO PIERCING - SERVICIO DE CATÁLOGO PDF       ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝

    🚀 Servidor corriendo en: http://localhost:${PORT}

    📍 Endpoints disponibles:
       GET  /api/generar-catalogo  - Generar y descargar PDF
       GET  /api/colecciones        - Obtener colecciones disponibles
       GET  /api/health             - Health check

    ✨ Listo para generar catálogos creativos!

    🌐 Abriendo navegador...

    ⚠️  IMPORTANTE: Para detener el servidor, presiona Ctrl+C
    `);

    // Abrir el navegador automáticamente usando comando nativo de Windows
    try {
        const { exec } = require('child_process');
        exec(`start http://localhost:${PORT}`);
    } catch (error) {
        console.error('No se pudo abrir el navegador automáticamente:', error.message);
        console.log('👉 Abre manualmente: http://localhost:' + PORT);
    }
});
*/

// Handler para cerrar el servidor correctamente con Ctrl+C
process.on('SIGINT', () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     🛑 Deteniendo servidor...                             ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     🛑 Servidor detenido                                  ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
});
