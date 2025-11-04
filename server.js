const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const shopifyService = require('./shopify-service');
const { organizarColeccionesPorCategoria, obtenerNombreColeccion } = require('./categorias-config');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint para obtener todas las colecciones organizadas por categoría
app.get('/api/colecciones', async (req, res) => {
    try {
        const colecciones = await shopifyService.obtenerColecciones();

        // Filtrar y formatear colecciones relevantes
        const coleccionesFormateadas = colecciones
            .filter(c => c.products_count > 0) // Solo colecciones con productos
            .map(c => ({
                handle: c.handle,
                title: obtenerNombreColeccion(c.handle, c.title),
                productCount: c.products_count,
                description: c.description || ''
            }));

        // Organizar por categorías
        const coleccionesPorCategoria = organizarColeccionesPorCategoria(coleccionesFormateadas);

        res.json({ categorias: coleccionesPorCategoria });
    } catch (error) {
        console.error('Error obteniendo colecciones:', error);
        res.status(500).json({ error: 'Error obteniendo colecciones de la tienda' });
    }
});

// Endpoint para generar el PDF - ahora con colección dinámica
app.get('/api/generar-catalogo', async (req, res) => {
    try {
        const coleccion = req.query.coleccion || 'nariz'; // Default: nariz

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📦 Iniciando generación de catálogo PDF`);
        console.log(`📁 Colección: ${coleccion}`);
        console.log('='.repeat(60));

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
        console.log('🖨️  Generando PDF con Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

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

        console.log('✅ PDF generado exitosamente\n');

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
                                ${!producto.disponible ? '<div class="sold-out-badge">AGOTADO</div>' : ''}
                            </div>
                            <div class="geometric-accent"></div>
                        </div>
                        <div class="product-info">
                            <h3 class="product-name">${producto.nombre}</h3>
                            <div class="price-tag">
                                <span class="price">${producto.precio}</span>
                                ${producto.disponible ? '<span class="stock-badge">En Stock</span>' : ''}
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
            <div class="geometric-shapes">
                <div class="shape shape-1"></div>
                <div class="shape shape-2"></div>
                <div class="shape shape-3"></div>
                <div class="shape shape-4"></div>
            </div>
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

            .geometric-shapes {
                position: absolute;
                inset: 0;
            }

            .shape {
                position: absolute;
                border: 2px solid rgba(18, 18, 18, 0.08);
                border-radius: 50%;
            }

            .shape-1 {
                width: 400px;
                height: 400px;
                top: -150px;
                right: -150px;
                border-width: 3px;
            }

            .shape-2 {
                width: 250px;
                height: 250px;
                bottom: -80px;
                left: -80px;
                border-width: 2px;
            }

            .shape-3 {
                width: 150px;
                height: 150px;
                top: 40%;
                right: 15%;
                border-style: dashed;
            }

            .shape-4 {
                width: 100px;
                height: 100px;
                bottom: 30%;
                left: 20%;
                border-width: 1px;
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

            .sold-out-badge {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(18, 18, 18, 0.9);
                color: white;
                padding: 4px 12px;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 1px;
                border-radius: 12px;
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

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     ∞  INFINITO PIERCING - SERVICIO DE CATÁLOGO PDF       ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝

    🚀 Servidor corriendo en: http://localhost:${PORT}

    📍 Endpoints disponibles:
       GET  /api/generar-catalogo  - Generar y descargar PDF
       GET  /api/health            - Health check

    ✨ Listo para generar catálogos creativos!
    `);
});
