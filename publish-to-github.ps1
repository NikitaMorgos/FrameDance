# Публикация на GitHub — находит Git и выполняет команды
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$gitPaths = @(
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    (Get-Command git -ErrorAction SilentlyContinue).Source
)
$git = $null
foreach ($p in $gitPaths) {
    if ($p -and (Test-Path $p)) { $git = $p; break }
}

if (-not $git) {
    Write-Host "Git не найден. Установите с https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host "После установки перезапустите терминал и снова запустите этот скрипт." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Используется: $git" -ForegroundColor Green
Write-Host ""

& $git init
& $git add .
& $git commit -m "Initial commit: FrameDance - bot, web, recaps base"
& $git branch -M main
& $git remote add origin https://github.com/NikitaMorgos/FrameDance.git 2>$null
if ($LASTEXITCODE -ne 0) {
    & $git remote set-url origin https://github.com/NikitaMorgos/FrameDance.git
}
& $git push -u origin main

Write-Host ""
Write-Host "Готово. Репозиторий: https://github.com/NikitaMorgos/FrameDance" -ForegroundColor Green
pause
