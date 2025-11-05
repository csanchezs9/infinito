const fetch = require('node-fetch');

const SHOPIFY_STORE = 'infinitopiercing.com';
const ITEMS_PER_PAGE = 250; // Shopify max

/**
 * Obtiene todas las colecciones disponibles en la tienda
 */
async function obtenerColecciones() {
    try {
        const url = `https://${SHOPIFY_STORE}/collections.json`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error al obtener colecciones: ${response.status}`);
        }

        const data = await response.json();
        return data.collections || [];
    } catch (error) {
        console.error('Error en obtenerColecciones:', error);
        throw error;
    }
}

/**
 * Obtiene todos los productos de una colección específica
 * Usa paginación correcta con Link headers y elimina duplicados
 * @param {string} coleccionHandle - El handle de la colección (ej: 'nariz', 'oreja')
 * @param {number} limit - Límite de productos por página (default: 250)
 */
async function obtenerProductosPorColeccion(coleccionHandle, limit = ITEMS_PER_PAGE) {
    try {
        let todosLosProductos = [];
        let productosUnicos = new Map(); // Usar Map para eliminar duplicados por ID
        let url = `https://${SHOPIFY_STORE}/collections/${coleccionHandle}/products.json?limit=${limit}`;
        let pageNum = 1;

        while (url) {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error al obtener productos: ${response.status}`);
            }

            const data = await response.json();
            const productos = data.products || [];

            if (productos.length === 0) {
                break;
            }

            // Agregar productos únicos al Map (elimina duplicados automáticamente)
            productos.forEach(producto => {
                productosUnicos.set(producto.id, producto);
            });

            // Buscar siguiente página en Link header
            const linkHeader = response.headers.get('Link');
            url = null; // Reset para próxima iteración

            if (linkHeader) {
                // Parsear Link header para encontrar rel="next"
                const links = linkHeader.split(',');
                for (const link of links) {
                    const match = link.match(/<([^>]+)>;\s*rel="next"/);
                    if (match) {
                        url = match[1];
                        pageNum++;
                        break;
                    }
                }
            }

            // Si obtuvimos menos productos que el límite, no hay más páginas
            if (productos.length < limit) {
                break;
            }
        }

        // Convertir Map a Array
        todosLosProductos = Array.from(productosUnicos.values());
        return todosLosProductos;
    } catch (error) {
        console.error('Error en obtenerProductosPorColeccion:', error);
        throw error;
    }
}

/**
 * Normaliza los productos de Shopify al formato usado en el PDF
 * @param {Array} productosShopify - Productos desde la API de Shopify
 */
function normalizarProductos(productosShopify) {
    return productosShopify.map(producto => {
        // Obtener la primera variante disponible o la primera en general
        const variantePrincipal = producto.variants.find(v => v.available) || producto.variants[0];

        // Obtener la primera imagen o usar placeholder
        const imagenPrincipal = producto.images && producto.images.length > 0
            ? producto.images[0].src
            : variantePrincipal?.featured_image?.src || '';

        return {
            id: producto.id,
            nombre: producto.title,
            precio: formatearPrecio(variantePrincipal?.price || '0'),
            imagen: imagenPrincipal,
            disponible: variantePrincipal?.available || false,
            handle: producto.handle,
            descripcion: producto.body_html || '',
            variantes: producto.variants.length,
            tags: producto.tags || [],
            tipo: producto.product_type || '',
            vendor: producto.vendor || ''
        };
    });
}

/**
 * Formatea el precio de Shopify (string) a formato colombiano
 * @param {string} precio - Precio en formato "25000.00"
 */
function formatearPrecio(precio) {
    const precioNumero = parseFloat(precio);
    if (isNaN(precioNumero)) return '$0';

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(precioNumero);
}

/**
 * Obtiene información de una colección específica
 * @param {string} coleccionHandle - El handle de la colección
 */
async function obtenerInfoColeccion(coleccionHandle) {
    try {
        // Primero intentar desde la lista de colecciones
        const colecciones = await obtenerColecciones();
        const coleccionEnLista = colecciones.find(c => c.handle === coleccionHandle);
        if (coleccionEnLista) {
            return coleccionEnLista;
        }

        // Si no está en la lista, intentar obtenerla directamente
        console.log(`Buscando colección oculta: ${coleccionHandle}`);
        const url = `https://${SHOPIFY_STORE}/collections/${coleccionHandle}/products.json?limit=1`;
        const response = await fetch(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        
        // Obtener el conteo total de productos
        const productos = await obtenerProductosPorColeccion(coleccionHandle);
        
        return {
            handle: coleccionHandle,
            title: coleccionHandle.charAt(0).toUpperCase() + coleccionHandle.slice(1),
            products_count: productos.length,
            description: ''
        };
    } catch (error) {
        console.error('Error en obtenerInfoColeccion:', error);
        return null;
    }
}

/**
 * Obtiene productos normalizados listos para usar en el catálogo
 * @param {string} coleccionHandle - El handle de la colección
 */
async function obtenerProductosParaCatalogo(coleccionHandle) {
    try {
        const productosShopify = await obtenerProductosPorColeccion(coleccionHandle);
        const productosNormalizados = normalizarProductos(productosShopify);
        return productosNormalizados;
    } catch (error) {
        console.error('Error en obtenerProductosParaCatalogo:', error);
        throw error;
    }
}

module.exports = {
    obtenerColecciones,
    obtenerProductosPorColeccion,
    normalizarProductos,
    obtenerInfoColeccion,
    obtenerProductosParaCatalogo,
    formatearPrecio
};
