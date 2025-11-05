const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const shopifyService = require('./shopify-service');
const { organizarColeccionesPorCategoria, obtenerNombreColeccion } = require('./categorias-config');

let mainWindow = null;
let tray = null;
let server = null;
let PORT = 3000;

// Configurar el servidor Express
function setupServer() {
    const expressApp = express();

    // Caché simple para colecciones (15 minutos)
    let cacheColecciones = null;
    let cacheTimestamp = null;
    const CACHE_DURATION = 15 * 60 * 1000;

    expressApp.use(cors());
    expressApp.use(express.json());

    // Servir archivos estáticos desde la carpeta public
    const publicPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'public')
        : path.join(__dirname, 'public');
    expressApp.use(express.static(publicPath));

    // Endpoint para obtener todas las colecciones organizadas por categoría
    expressApp.get('/api/colecciones', async (req, res) => {
        try {
            const ahora = Date.now();
            if (cacheColecciones && cacheTimestamp && (ahora - cacheTimestamp) < CACHE_DURATION) {
                return res.json(cacheColecciones);
            }

            const { CATEGORIAS } = require('./categorias-config');
            const todasLasColeccionesDefinidas = new Set();

            for (const categoria of Object.values(CATEGORIAS)) {
                categoria.colecciones.forEach(handle => todasLasColeccionesDefinidas.add(handle));
            }

            const coleccionesFormateadas = [];

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

            const coleccionesPorCategoria = organizarColeccionesPorCategoria(coleccionesFormateadas);

            cacheColecciones = { categorias: coleccionesPorCategoria };
            cacheTimestamp = ahora;

            res.json({ categorias: coleccionesPorCategoria });
        } catch (error) {
            console.error('Error obteniendo colecciones:', error);
            res.status(500).json({ error: 'Error obteniendo colecciones de la tienda' });
        }
    });

    // Endpoint para generar el PDF
    expressApp.get('/api/generar-catalogo', async (req, res) => {
        try {
            const coleccion = req.query.coleccion || 'nariz';
            const productos = await shopifyService.obtenerProductosParaCatalogo(coleccion);

            if (productos.length === 0) {
                return res.status(404).json({
                    error: `No se encontraron productos en la colección '${coleccion}'`
                });
            }

            const infoColeccion = await shopifyService.obtenerInfoColeccion(coleccion);
            const nombreColeccion = infoColeccion?.title || coleccion.toUpperCase();

            // Importar función de generación de HTML desde pdf-generator
            const { generarHTML } = require('./pdf-generator');
            const html = await generarHTML(productos, nombreColeccion);

            // Configurar Puppeteer para funcionar en aplicación empaquetada
            const puppeteerOptions = {
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            };

            // Si está empaquetado, usar el Chrome/Chromium empaquetado
            if (app.isPackaged) {
                const chromiumPath = puppeteer.executablePath();
                puppeteerOptions.executablePath = chromiumPath;
            }

            const browser = await puppeteer.launch(puppeteerOptions);

            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
            });

            await browser.close();

            const filename = `catalogo-infinito-${coleccion}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Error generando PDF:', error);
            res.status(500).json({
                error: 'Error generando el catálogo PDF',
                details: error.message
            });
        }
    });

    // Health check
    expressApp.get('/api/health', (req, res) => {
        res.json({ status: 'ok', message: 'Servicio funcionando' });
    });

    // Intentar iniciar servidor con manejo de puerto ocupado
    return new Promise((resolve, reject) => {
        const tryPort = (port) => {
            server = expressApp.listen(port, () => {
                PORT = port;
                console.log(`✓ Servidor iniciado en http://localhost:${PORT}`);
                resolve(port);
            }).on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Puerto ${port} ocupado, probando ${port + 1}...`);
                    tryPort(port + 1);
                } else {
                    reject(err);
                }
            });
        };
        tryPort(PORT);
    });
}

// Verificar que el servidor está listo
async function esperarServidor(puerto, maxIntentos = 30) {
    const http = require('http');

    for (let i = 0; i < maxIntentos; i++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(`http://localhost:${puerto}/api/health`, (res) => {
                    if (res.statusCode === 200) {
                        resolve();
                    } else {
                        reject();
                    }
                });
                req.on('error', reject);
                req.setTimeout(1000, () => {
                    req.destroy();
                    reject();
                });
            });
            console.log(`✓ Servidor respondiendo en puerto ${puerto}`);
            return true;
        } catch (error) {
            if (i < maxIntentos - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    return false;
}

// Crear ventana principal
async function createWindow() {
    // Esperar a que el servidor esté realmente listo
    console.log(`⏳ Esperando a que el servidor en puerto ${PORT} responda...`);
    const servidorListo = await esperarServidor(PORT);

    if (!servidorListo) {
        console.error('❌ El servidor no respondió a tiempo');
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Infinito Piercing - Sistema de Catálogos',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        backgroundColor: '#ffffff',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        autoHideMenuBar: true,
        show: false
    });

    // Mostrar ventana cuando esté lista
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Cargar la aplicación
    console.log(`✓ Cargando interfaz desde http://localhost:${PORT}`);
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Cerrar completamente al presionar X
    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit();
    });
}

// Crear icono en bandeja del sistema
function createTray() {
    // Crear un icono simple si no existe el archivo
    const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIpSURBVFhH7ZbPS1RRFMc/M2NqamqWmVKZlUFRQbRoEUSbIAiiRYv+gKBNEP0BLVq1aBMRRIsIokWbIIh+QBBBUEFhEZVZ/kxTx5/z+r7hzePNvHkz82bGhQ98uPfde8/5nnvPuee+SiaTyWQymf9MJpPJ/Gf+uQVKpVKUSqVisVisqqqKqqurqaamhurq6qi+vp4aGhqosbGRmpqaqLm5mVpaWqi1tZXa2tqovb2dOjo6qLOzk7q6uqi7u5t6enqot7eX+vr6aGBggAYHB2loaIiGh4dpZGSERkdHaWxsjMbHx2liYoImJydpamqKpqenaWZmhp/NxMTEhL6+PpqcnKTJyUmampqimZkZmp2dpbm5OZqfn+dlv8jLy8vLtLKywsurq6u0trZG6+vrtLGxQZubm7S1tUXb29u0s7NDu7u7tLe3R/v7+3RwcECHh4d0dHREx8fHdHJyQqenp3R2dkbn5+d0cXFBl5eXdHV1RdfX13Rzc8PLv8jLt7e3dHd3R/f393w8Pj7S09MTPT8/08vLC72+vtLb2xu9v7/Tx8cHfX5+0tfXF31/f9PPzw/9/v7Sn5+fv+Tlv79/9Pf3R3///tH//z8tLCzQ4uIiLS0t0fLyMq2srNDq6iqtra3R+vo6bWxs0ObmJm1tbdH29jbt7OzQ7u4u7e3t0f7+Ph0cHNDh4SEdHR3R8fExnZyc0OnpKZ2dndH5+TldXFzQ5eUlXV1d0fX1Nd3c3NDt7S3d3d3R/f09j4eHBx4PD4/08vLCy6+vr/T29sbL7+/vPC7i5Q9YR/5JwMvWfgAAAABJRU5ErkJggg==');

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Mostrar Infinito Catálogos',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Salir',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Infinito Piercing - Sistema de Catálogos');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
    });
}

// Eventos de la aplicación
app.whenReady().then(async () => {
    console.log('🚀 Iniciando Infinito Piercing - Sistema de Catálogos...');

    // Iniciar servidor Express y esperar a que esté listo
    try {
        const puerto = await setupServer();
        console.log(`✓ Servidor iniciado en puerto ${puerto}`);

        // Crear ventana (esperará activamente a que el servidor responda)
        await createWindow();
        createTray();
    } catch (error) {
        console.error('Error iniciando aplicación:', error);
        app.quit();
    }

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Cerrar la aplicación completamente cuando se cierren todas las ventanas
    app.quit();
});

app.on('before-quit', () => {
    app.isQuitting = true;
    if (server) {
        server.close();
    }
});

app.on('will-quit', () => {
    if (tray) {
        tray.destroy();
    }
});
