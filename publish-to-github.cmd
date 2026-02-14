@echo off
cd /d "%~dp0"
set "LOG=%~dp0publish-log.txt"

echo [%date% %time%] Publish to GitHub > "%LOG%"
echo. >> "%LOG%"

set "GIT_EXE="
if exist "C:\Program Files\Git\bin\git.exe" set "GIT_EXE=C:\Program Files\Git\bin\git.exe"
if exist "C:\Program Files (x86)\Git\bin\git.exe" set "GIT_EXE=C:\Program Files (x86)\Git\bin\git.exe"

if not defined GIT_EXE (
    echo Git not found. Install from https://git-scm.com/download/win >> "%LOG%"
    echo Then run this script again. >> "%LOG%"
    start notepad "%LOG%"
    exit /b 1
)

echo Using: %GIT_EXE% >> "%LOG%"
echo. >> "%LOG%"

"%GIT_EXE%" init >> "%LOG%" 2>&1
"%GIT_EXE%" add . >> "%LOG%" 2>&1
"%GIT_EXE%" commit -m "Initial commit: FrameDance - bot, web, recaps base" >> "%LOG%" 2>&1
"%GIT_EXE%" branch -M main >> "%LOG%" 2>&1
"%GIT_EXE%" remote add origin https://github.com/NikitaMorgos/FrameDance.git >> "%LOG%" 2>&1
if errorlevel 1 "%GIT_EXE%" remote set-url origin https://github.com/NikitaMorgos/FrameDance.git >> "%LOG%" 2>&1
"%GIT_EXE%" push -u origin main >> "%LOG%" 2>&1

echo. >> "%LOG%"
echo Exit code: %ERRORLEVEL% >> "%LOG%"
echo. >> "%LOG%"
echo Repo: https://github.com/NikitaMorgos/FrameDance >> "%LOG%"

start notepad "%LOG%"
