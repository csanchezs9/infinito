# 📦 Infinito Piercing - Generador de Catálogos PDF

Sistema automatizado para generar catálogos PDF profesionales con productos directamente desde la tienda Shopify de Infinito Piercing.

## ✨ Características

- 🔄 **Datos en Tiempo Real**: Obtiene productos directamente desde la API de Shopify
- 📁 **Múltiples Colecciones**: Genera catálogos para cualquier colección (Oreja, Nariz, Corporal, etc.)
- 🎨 **Diseño Minimalista**: Estilo blanco y negro alineado con el branding oficial
- 📄 **PDFs Profesionales**: Catálogos listos para imprimir en formato A4
- ⚡ **Sin Archivos Estáticos**: No requiere descargar imágenes ni datos localmente

## 🚀 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/csanchezs9/infinito.git
cd infinito

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

## 📖 Uso

1. Abre tu navegador en `http://localhost:3000`
2. Selecciona la colección que deseas (Nariz, Oreja, Corporal, etc.)
3. Haz clic en "GENERAR CATÁLOGO"
4. El PDF se generará y descargará automáticamente

## 🛠️ Tecnologías

- **Node.js** + **Express**: Backend del servidor
- **Puppeteer**: Generación de PDFs
- **Shopify API**: Fuente de datos de productos
- **HTML/CSS/JavaScript**: Interfaz de usuario

## 📡 API Endpoints

### `GET /api/colecciones`
Obtiene todas las colecciones disponibles en la tienda

**Respuesta:**
```json
{
  "colecciones": [
    {
      "handle": "nariz",
      "title": "Nariz",
      "productCount": 81,
      "description": "..."
    }
  ]
}
```

### `GET /api/generar-catalogo?coleccion={handle}`
Genera un PDF con los productos de la colección especificada

**Parámetros:**
- `coleccion` (string): Handle de la colección (ej: `nariz`, `oreja`, `corporal`)

**Respuesta:**
- PDF file (application/pdf)

### `GET /api/health`
Verifica el estado del servidor

## 📁 Estructura del Proyecto

```
infinito/
├── server.js              # Servidor Express principal
├── shopify-service.js     # Servicio para API de Shopify
├── public/
│   └── index.html        # Interfaz de usuario
├── package.json
└── README.md
```

## 🎨 Diseño del Catálogo

El PDF generado incluye:
- **Portada**: Con símbolo infinito y nombre de la colección
- **Grid de Productos**: 4 productos por página (2x2)
- **Información del Producto**: Nombre, precio, imagen, estado de stock
- **Footer**: Número de página y URL de la tienda

## 🔧 Configuración

El sistema está configurado para usar la tienda `infinitopiercing.com`. Si necesitas cambiar la tienda, modifica la constante en `shopify-service.js`:

```javascript
const SHOPIFY_STORE = 'infinitopiercing.com';
```

## 📝 Notas

- Los productos se obtienen en tiempo real desde Shopify
- Las imágenes se cargan directamente desde el CDN de Shopify
- El sistema maneja automáticamente la paginación para colecciones grandes
- Los precios se formatean en pesos colombianos (COP)

## 🤝 Contribuir

Este proyecto es mantenido por el equipo de Infinito Piercing. Para contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y pertenece a Infinito Piercing.

## 🔗 Links

- 🌐 [Sitio Web](https://infinitopiercing.com)
- 📦 [Repositorio GitHub](https://github.com/csanchezs9/infinito)

---

Desarrollado con ❤️ para Infinito Piercing
