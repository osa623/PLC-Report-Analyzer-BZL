$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
$pidFile = Join-Path $root "backend_pids.json"
$backendPorts = @(3000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012, 8013, 8014)
$stoppedProcIds = New-Object System.Collections.Generic.HashSet[int]

function Stop-ProcessSafe {
    param(
        [int]$ProcId,
        [string]$DisplayName
    )

    if ($stoppedProcIds.Contains($ProcId)) {
        return
    }

    try {
        $proc = Get-Process -Id $ProcId -ErrorAction Stop
        Stop-Process -Id $ProcId -Force -ErrorAction Stop
        [void]$stoppedProcIds.Add($ProcId)
        Write-Host ("Stopped {0} (PID {1})" -f $DisplayName, $ProcId) -ForegroundColor Green
    }
    catch {
        Write-Warning ("Could not stop {0} (PID {1}) - may already be stopped." -f $DisplayName, $ProcId)
    }
}

if (Test-Path $pidFile) {
    $entries = Get-Content $pidFile -Raw | ConvertFrom-Json
    if ($entries -isnot [System.Array]) {
        $entries = @($entries)
    }

    foreach ($entry in $entries) {
        $procId = [int]$entry.pid
        Stop-ProcessSafe -ProcId $procId -DisplayName $entry.service
    }
}
else {
    Write-Warning "backend_pids.json not found. Trying port-based cleanup only."
}

# Fallback: kill any remaining listeners on known backend ports.
$listenerProcIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $backendPorts } |
    Select-Object -ExpandProperty OwningProcess -Unique

if ($listenerProcIds) {
    foreach ($listenerProcId in $listenerProcIds) {
        $portMatches = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.OwningProcess -eq $listenerProcId -and $_.LocalPort -in $backendPorts } |
            Select-Object -ExpandProperty LocalPort

        $displayName = "port-listener " + (($portMatches | Sort-Object | Get-Unique) -join ",")
        Stop-ProcessSafe -ProcId ([int]$listenerProcId) -DisplayName $displayName
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $backendPorts } |
    Select-Object LocalAddress, LocalPort, OwningProcess |
    Sort-Object LocalPort

if ($remaining) {
    Write-Warning "Some backend ports are still listening:"
    $remaining | Format-Table -AutoSize
}
else {
    Write-Host "All backend ports are free." -ForegroundColor Cyan
}

Write-Host "Done." -ForegroundColor Cyan
