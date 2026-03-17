$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
$pidFile = Join-Path $root "backend_pids.json"

if (-not (Test-Path $pidFile)) {
    Write-Warning "backend_pids.json not found. Nothing to stop."
    exit 0
}

$entries = Get-Content $pidFile -Raw | ConvertFrom-Json
if ($entries -isnot [System.Array]) {
    $entries = @($entries)
}

foreach ($entry in $entries) {
    $pid = [int]$entry.pid
    try {
        $proc = Get-Process -Id $pid -ErrorAction Stop
        Stop-Process -Id $pid -Force
        Write-Host ("Stopped {0} (PID {1})" -f $entry.service, $pid) -ForegroundColor Green
    }
    catch {
        Write-Warning ("Could not stop {0} (PID {1}) - may already be stopped." -f $entry.service, $pid)
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Cyan
