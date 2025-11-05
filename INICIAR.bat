@echo off
chcp 65001 >nul
title Infinito Piercing - Catálogo PDF

:: Banner
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║     ∞  INFINITO PIERCING - CATALOGO PDF                   ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: Crear acceso directo (silenciosamente, sin detener si falla)
echo Creando acceso directo en el escritorio...
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -Command "& {$Desktop = [Environment]::GetFolderPath('Desktop'); if ([string]::IsNullOrEmpty($Desktop)) { $Desktop = \"$env:USERPROFILE\Desktop\" }; if (-not (Test-Path $Desktop) -and (Test-Path \"$env:OneDrive\Desktop\")) { $Desktop = \"$env:OneDrive\Desktop\" }; try { if (-not (Test-Path $Desktop)) { New-Item -ItemType Directory -Path $Desktop -Force | Out-Null }; $WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut(\"$Desktop\Infinito Catalogos.lnk\"); $SC.TargetPath = '%~dp0INICIAR.bat'; $SC.WorkingDirectory = '%~dp0'; $SC.Description = 'Infinito Piercing - Sistema de Catalogos'; if (Test-Path '%~dp0assets\icon.ico') { $SC.IconLocation = '%~dp0assets\icon.ico' }; $SC.Save(); Write-Host '✅ Acceso directo creado en el escritorio' -ForegroundColor Green } catch { Write-Host '⚠️ No se pudo crear el acceso directo (esto es normal)' -ForegroundColor Yellow } }"
echo.

echo Iniciando aplicacion...
echo.
echo El servidor se cerrara automaticamente cuando cierres el navegador
echo (o puedes cerrar esta ventana CMD manualmente)
echo.

:: Intentar ejecutar el .exe primero (version portable)
if exist "%~dp0InfinitoCatalogo.exe" (
    echo.
    echo Ejecutando InfinitoCatalogo.exe
    echo.
    "%~dp0InfinitoCatalogo.exe"
    goto :fin
)

:: Si no existe el .exe, intentar con dist\InfinitoCatalogo.exe
if exist "%~dp0dist\InfinitoCatalogo.exe" (
    echo.
    echo Ejecutando desde carpeta dist
    echo.
    "%~dp0dist\InfinitoCatalogo.exe"
    goto :fin
)

:: Si no existe el .exe, intentar con Node.js
echo.
echo Ejecutando con Node.js
echo.
node "%~dp0server.js"

:: Si Node.js fallo, mostrar error
if errorlevel 1 (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║                                                            ║
    echo ║  ERROR: No se encontro InfinitoCatalogo.exe                ║
    echo ║         ni Node.js instalado                               ║
    echo ║                                                            ║
    echo ║  Opciones:                                                 ║
    echo ║                                                            ║
    echo ║  1. Asegurate de extraer TODOS los archivos del ZIP       ║
    echo ║     incluyendo InfinitoCatalogo.exe                        ║
    echo ║                                                            ║
    echo ║  2. O instala Node.js desde: https://nodejs.org           ║
    echo ║                                                            ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    pause
    exit
)

:fin

:: Cuando el servidor se cierra (auto o Ctrl+C)
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✅ Servidor detenido correctamente                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Cerrando ventana en 2 segundos...
ping 127.0.0.1 -n 3 >nul
exit
