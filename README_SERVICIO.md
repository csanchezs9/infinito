# Servicio de Generación de Catálogo PDF - Infinito Piercing

Servicio Node.js + Express que genera catálogos PDF creativos usando Puppeteer.

## Características del Diseño

- **Portada impactante** con símbolo infinito y diseño geométrico
- **Paleta de colores oficial** de Infinito Piercing (#AFEB44, #121212)
- **Grid moderno** de 3 columnas para productos
- **Badges de estado** (En Stock / Agotado)
- **Numeración elegante** de productos y páginas
- **Headers y footers** con diseño profesional
- **Patrones geométricos** únicos en cada página

## Instalación

```bash
npm install
```

## Uso

### Iniciar el servidor

```bash
npm start
```

### Desarrollo (con auto-reload)

```bash
npm run dev
```

## Endpoints

### Generar Catálogo PDF
```
GET http://localhost:3000/api/generar-catalogo
```

Genera y descarga el catálogo completo en formato PDF.

### Health Check
```
GET http://localhost:3000/api/health
```

Verifica que el servicio esté funcionando.

## Estructura del PDF

1. **Portada**
   - Logo con símbolo infinito (∞)
   - Nombre de la colección
   - Estadísticas (53 productos, catálogo 2025)
   - Diseño con formas geométricas animadas

2. **Páginas de productos** (6 productos por página)
   - Grid de 3x2
   - Imagen del producto
   - Nombre y precio
   - Indicador de disponibilidad
   - Numeración única

3. **Footer en cada página**
   - Número de página
   - Información de contacto
   - Línea decorativa con color accent

## Personalización

Los colores y estilos se pueden modificar en las variables CSS:

```css
:root {
    --color-dark: #121212;
    --color-accent: #AFEB44;
    --color-accent-dark: #8A9723;
    --color-white: #FFFFFF;
    --color-whatsapp: #2DB742;
}
```

## Tecnologías

- Node.js
- Express.js
- Puppeteer (generación de PDF)
- HTML/CSS personalizado
- Google Fonts (Assistant, Bebas Neue)

## Requisitos

- Node.js 16+
- npm o yarn
- Archivo `productos_nariz_simple.json` en el directorio raíz
