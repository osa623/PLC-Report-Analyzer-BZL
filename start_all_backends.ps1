param(
    [switch]$Build,
    [switch]$Detached
)

$ErrorActionPreference = "Stop"

$composeFile = Join-Path $PSScriptRoot "docker-compose.yml"
if (-not (Test-Path $composeFile)) {
    throw "docker-compose.yml not found at $composeFile"
}

$composeArgs = @("compose", "-f", $composeFile, "up")
if ($Build) {
    $composeArgs += "--build"
}
if ($Detached) {
    $composeArgs += "-d"
}

Write-Host "Starting all backend services using Docker Compose..." -ForegroundColor Cyan
Write-Host "Command: docker $($composeArgs -join ' ')" -ForegroundColor DarkGray

& docker @composeArgs
