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

echo Iniciando servidor...
echo.
echo ✅ El servidor se cerrara automaticamente cuando cierres el navegador
echo    (o puedes cerrar esta ventana CMD manualmente)
echo.

:: Iniciar Node.js
node server.js

:: Si Node.js no está instalado, mostrar error
if errorlevel 1 (
    echo.
    echo ╔════════════════════════════════════════════════════════════╗
    echo ║  ⚠️  ERROR: Node.js no está instalado                     ║
    echo ║                                                            ║
    echo ║  📥 Descarga Node.js desde:                               ║
    echo ║     https://nodejs.org                                    ║
    echo ║                                                            ║
    echo ║  O usa el ejecutable .exe si está disponible              ║
    echo ╚════════════════════════════════════════════════════════════╝
    echo.
    pause
    exit
)

:: Cuando el servidor se cierra (Ctrl+C)
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✅ Servidor detenido correctamente                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause
