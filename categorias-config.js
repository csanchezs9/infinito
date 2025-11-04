/**
 * Configuración de categorías y mapeo de colecciones
 * Basado en la estructura del menú de infinitopiercing.com
 */

const CATEGORIAS = {
    'parte-cuerpo': {
        nombre: 'Parte del Cuerpo',
        emoji: '👤',
        colecciones: [
            'oreja',
            'nariz',
            'ceja',
            'bucal',
            'corporal',
            'intimas'
        ]
    },
    'tipos-perforacion': {
        nombre: 'Tipos de Perforación',
        emoji: '📍',
        colecciones: [
            'helix',
            'helix-1',
            'flat',
            'conch',
            'forward-anti-helix',
            'daith',
            'industrial',
            'expansion'
        ]
    },
    'bisuteria': {
        nombre: 'Bisutería',
        emoji: '💍',
        colecciones: [
            'candongas',
            'anillos',
            'dijens',
            'earcuff'
        ]
    },
    'tipo-material': {
        nombre: 'Tipo de Material',
        emoji: '⚡',
        colecciones: [
            'titanio',
            'acero',
            'oro',
            'covergold',
            'esmeraldas'
        ]
    },
    'tipo-joya': {
        nombre: 'Tipo de Joya',
        emoji: '💎',
        colecciones: [
            'aro',
            'chispa-nostril',
            'labret',
            'barra-barbell',
            'barbell-barra',
            'herradura',
            'bcr',
            'expansores',
            'barra-pezon-nipple',
            'banana-curved-barbell'
        ]
    }
};

/**
 * Organiza las colecciones por categorías
 * @param {Array} colecciones - Array de colecciones desde Shopify
 * @returns {Object} Colecciones organizadas por categoría
 */
function organizarColeccionesPorCategoria(colecciones) {
    const resultado = {};
    const coleccionesUsadas = new Set();

    // Organizar por categorías definidas
    for (const [categoriaKey, categoriaData] of Object.entries(CATEGORIAS)) {
        resultado[categoriaKey] = {
            nombre: categoriaData.nombre,
            emoji: categoriaData.emoji,
            colecciones: []
        };

        for (const handle of categoriaData.colecciones) {
            const coleccion = colecciones.find(c => c.handle === handle);
            if (coleccion) {
                resultado[categoriaKey].colecciones.push(coleccion);
                coleccionesUsadas.add(coleccion.handle);
            }
        }

        // Ordenar por cantidad de productos (mayor a menor)
        resultado[categoriaKey].colecciones.sort((a, b) => b.productCount - a.productCount);
    }

    // Agregar categoría "Otras" para colecciones no clasificadas
    const coleccionesNoClasificadas = colecciones.filter(c => !coleccionesUsadas.has(c.handle));
    if (coleccionesNoClasificadas.length > 0) {
        resultado['otras'] = {
            nombre: 'Otras Colecciones',
            emoji: '📦',
            colecciones: coleccionesNoClasificadas.sort((a, b) => b.productCount - a.productCount)
        };
    }

    // Eliminar categorías vacías
    for (const key in resultado) {
        if (resultado[key].colecciones.length === 0) {
            delete resultado[key];
        }
    }

    return resultado;
}

/**
 * Obtiene el nombre en español de una colección
 */
const NOMBRES_COLECCIONES = {
    // Parte del cuerpo
    'oreja': 'Oreja',
    'nariz': 'Nariz',
    'ceja': 'Ceja',
    'ceja-1': 'Ceja',
    'bucal': 'Bucal',
    'corporal': 'Corporal',
    'intimas': 'Íntimas',

    // Tipos de perforación
    'helix': 'Helix',
    'helix-1': 'Helix',
    'flat': 'Flat',
    'conch': 'Conch',
    'forward-anti-helix': 'Forward Anti-helix',
    'daith': 'Daith',
    'industrial': 'Industrial',
    'expansion': 'Expansión',

    // Bisutería
    'candongas': 'Candongas',
    'anillos': 'Anillos',
    'dijens': 'Dijes',
    'earcuff': 'Ear Cuff',

    // Materiales
    'titanio': 'Titanio',
    'acero': 'Acero',
    'oro': 'Oro',
    'covergold': 'Covergold',
    'esmeraldas': 'Esmeraldas',

    // Tipos de joya
    'aro': 'Aro',
    'chispa-nostril': 'Chispa (Nostril)',
    'labret': 'Labret',
    'barra-barbell': 'Barra (Barbell)',
    'barbell-barra': 'Barbell',
    'herradura': 'Herradura',
    'bcr': 'BCR',
    'expansores': 'Expansores',
    'barra-pezon-nipple': 'Barra Pezón',
    'banana-curved-barbell': 'Banana (Curved Barbell)'
};

function obtenerNombreColeccion(handle, titleOriginal) {
    return NOMBRES_COLECCIONES[handle] || titleOriginal;
}

module.exports = {
    CATEGORIAS,
    organizarColeccionesPorCategoria,
    obtenerNombreColeccion
};
