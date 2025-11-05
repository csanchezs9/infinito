@echo off
chcp 65001 >nul
title Cerrar Procesos de Infinito Catalogos

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║     🛑 CERRAR PROCESOS DE INFINITO CATALOGOS              ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Este script cerrara todos los procesos de InfinitoCatalogo
echo que puedan estar corriendo en segundo plano.
echo.
pause
echo.

:: Cerrar por nombre de proceso
echo 🔍 Buscando procesos de InfinitoCatalogo.exe...
tasklist /FI "IMAGENAME eq InfinitoCatalogo.exe" 2>NUL | find /I /N "InfinitoCatalogo.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Encontrado proceso InfinitoCatalogo.exe, cerrando...
    taskkill /F /IM InfinitoCatalogo.exe >nul 2>&1
    echo ✅ Proceso cerrado
) else (
    echo ℹ️  No se encontro proceso InfinitoCatalogo.exe
)

echo.
echo 🔍 Buscando procesos de Node.js en puerto 3000...

:: Buscar procesos en puertos 3000-3004
for %%p in (3000 3001 3002 3003 3004) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        echo ✅ Cerrando proceso en puerto %%p (PID: %%a)...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║     ✅ LIMPIEZA COMPLETADA                                ║
echo ║                                                            ║
echo ║     Ahora puedes ejecutar INICIAR.bat de nuevo            ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause
