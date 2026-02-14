@echo off
cd /d "%~dp0"

set "NODE_DIR="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_DIR=C:\Program Files\nodejs"
if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "NODE_DIR=%LOCALAPPDATA%\Programs\node"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_DIR=%ProgramFiles(x86)%\nodejs"

if not defined NODE_DIR (
    echo Node.js не найден. Установите с https://nodejs.org
    pause
    exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
echo Запуск сайта FrameDance...
echo Открой в браузере: http://localhost:3000
echo.
start "" "http://localhost:3000"
npm run server
pause
