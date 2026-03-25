param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir"
    exit 1
}

Write-Host "Starting Frontend..." -ForegroundColor Cyan

Push-Location $frontendDir

try {
    if ($Install -or (-not (Test-Path "node_modules"))) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install
    }

    Write-Host "Launching Vite development server..." -ForegroundColor Green
    npm run dev
}
catch {
    Write-Error "Failed to start frontend: $_"
}
finally {
    Pop-Location
}