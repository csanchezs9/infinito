# 🚀 Infinito Piercing - Aplicación de Escritorio

## 📋 Descripción

Aplicación de escritorio profesional para generar catálogos PDF con Electron.

---

## ✅ Estado Actual

✔️ Electron instalado y configurado
✔️ Aplicación de escritorio creada
✔️ Icono en bandeja del sistema
✔️ Configuración de build lista
⚠️  **FALTA**: Agregar icono personalizado en `assets/icon.ico` y `assets/icon.png`

---

## 🎯 ¿Qué hace esta aplicación?

1. **Abre una ventana dedicada** sin barras de navegador
2. **Servidor Express integrado** se inicia automáticamente
3. **Icono en bandeja del sistema** (system tray)
4. **Minimiza a bandeja** en lugar de cerrar
5. **Aspecto profesional** como software empresarial

---

## 🚀 Cómo Usar

### Modo Desarrollo (Probar la app)
```bash
npm run electron
```

### Generar Ejecutable .exe
```bash
npm run build
```

El archivo `.exe` se generará en la carpeta `dist/`

---

## 📦 Lo que incluye el .exe

- ✅ Instalador NSIS profesional
- ✅ Acceso directo en escritorio
- ✅ Acceso directo en menú inicio
- ✅ Desinstalador
- ✅ Servidor integrado (no requiere instalar Node.js)
- ✅ Todo el código y dependencias empaquetadas

---

## 🎨 Personalizar Icono

### Paso 1: Crear iconos

Necesitas crear dos archivos de icono:

1. **icon.png** (512x512px o mayor)
2. **icon.ico** (para Windows)

Puedes usar herramientas online como:
- https://icoconvert.com/ (convierte PNG a ICO)
- https://www.favicon-generator.org/

### Paso 2: Colocar iconos

Pon los archivos en la carpeta `assets/`:
```
INFINITO/
├── assets/
│   ├── icon.png    ← Aquí
│   └── icon.ico    ← Aquí
```

---

## 📝 Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run electron` | Ejecutar app en modo desarrollo |
| `npm run electron-dev` | Ejecutar con DevTools para debug |
| `npm run build` | Generar instalador .exe |
| `npm run build-portable` | Generar versión portable (sin instalador) |

---

## 🎁 Características Premium

### Para tu Cliente:

1. **Doble clic y listo** - No necesita saber de Node.js ni servidores
2. **Se ve como software profesional** - Ventana dedicada, sin Chrome
3. **Icono en escritorio** - Fácil acceso
4. **Bandeja del sistema** - No ocupa espacio en la barra de tareas
5. **Instalador profesional** - Como cualquier software comercial

### Ventajas vs navegador:

- ❌ **Navegador**: Barra de URL, extensiones, distracciones
- ✅ **Electron App**: Ventana limpia, enfocada, profesional

---

## 🔧 Troubleshooting

### Si el icono no aparece:
1. Verifica que `assets/icon.ico` y `assets/icon.png` existan
2. Vuelve a ejecutar `npm run build`

### Si falla el build:
```bash
# Limpiar e intentar de nuevo
rm -rf dist node_modules
npm install
npm run build
```

---

## 💡 Próximos Pasos Recomendados

1. **Agregar icono personalizado** con el logo de Infinito Piercing
2. **Probar la app**: `npm run electron`
3. **Generar el .exe**: `npm run build`
4. **Entregar al cliente** el instalador de `dist/`

---

## 📬 Estructura de Archivos

```
INFINITO/
├── electron-main.js       ← Código principal de Electron
├── server.js             ← Servidor Express (para desarrollo web)
├── pdf-generator.js      ← Lógica de generación de PDF
├── shopify-service.js    ← Conexión con Shopify
├── categorias-config.js  ← Configuración de categorías
├── package.json          ← Configuración con scripts de Electron
├── public/
│   └── index.html        ← Frontend
└── assets/
    ├── icon.png          ← Icono de la app (crea este)
    └── icon.ico          ← Icono Windows (crea este)
```

---

## 🎉 ¡Listo para Vender!

Tu cliente solo necesita:
1. **Instalar el .exe** (doble clic)
2. **Abrir la aplicación** desde el escritorio
3. **Generar catálogos** como siempre

**¡No necesita conocimientos técnicos!** 🚀
