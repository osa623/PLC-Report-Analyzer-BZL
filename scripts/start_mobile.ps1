# script to start the mobile Expo app easily
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot/mobile

# Check if node_modules exists, install if missing
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing mobile dependencies..."
    npm install
}

Write-Host "Starting Expo server..."
npm start
