param(
    [switch]$NoReload
)

# Starts the local stack in separate PowerShell windows using one central repo .env.
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$envFile = Join-Path $repoRoot ".env"
$venv = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $envFile)) {
    Write-Error "Central env file not found at $envFile. Create it from .env.sample first."
    exit 1
}

if (-not (Test-Path $venv)) {
    Write-Error "Virtualenv activate script not found at $venv. Create .venv and install dependencies first."
    exit 1
}

function Import-DotEnv([string]$path) {
    foreach ($line in Get-Content $path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }
        $eq = $trimmed.IndexOf("=")
        if ($eq -lt 1) {
            continue
        }
        $key = $trimmed.Substring(0, $eq).Trim()
        $value = $trimmed.Substring($eq + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

function Resolve-Port([string]$name, [int]$defaultValue) {
    $raw = [Environment]::GetEnvironmentVariable($name, "Process")
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $defaultValue
    }
    $port = 0
    if (-not [int]::TryParse($raw, [ref]$port)) {
        throw "Invalid port in ${name}: '$raw'"
    }
    return $port
}

function Assert-PortFree([int]$port, [string]$serviceName) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pids = ($conn | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique) -join ", "
        throw "Port $port for $serviceName is already in use by PID(s): $pids"
    }
}

function Start-ServiceWindow([string]$name, [string]$command) {
    Start-Process -FilePath powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Normal
    Write-Host "Started $name"
}

Import-DotEnv $envFile

$servicePorts = @{
    "NODE_BACKEND_PORT" = Resolve-Port "NODE_BACKEND_PORT" 3000
    "EXTRACTION_SERVICE_PORT" = Resolve-Port "EXTRACTION_SERVICE_PORT" 8001
    "ANALYSIS_SERVICE_PORT" = Resolve-Port "ANALYSIS_SERVICE_PORT" 8002
    "REPORTING_SERVICE_PORT" = Resolve-Port "REPORTING_SERVICE_PORT" 8003
    "PIPELINE_ORCHESTRATOR_PORT" = Resolve-Port "PIPELINE_ORCHESTRATOR_PORT" 8100
    "ANNUAL_REPORT_BACKEND_PORT" = Resolve-Port "ANNUAL_REPORT_BACKEND_PORT" 5000
}

foreach ($entry in $servicePorts.GetEnumerator()) {
    Assert-PortFree $entry.Value $entry.Key
}

$reloadFlag = if ($NoReload) { "" } else { " --reload" }

$pySetup = "Set-Location '$repoRoot'; . '$venv'; `$env:PYTHONPATH='$repoRoot'"

Start-ServiceWindow "extraction_service :$($servicePorts['EXTRACTION_SERVICE_PORT'])" "$pySetup; `$env:PORT='$($servicePorts['EXTRACTION_SERVICE_PORT'])'; uvicorn services.extraction_service.app:app --host 0.0.0.0 --port $($servicePorts['EXTRACTION_SERVICE_PORT'])$reloadFlag"
Start-ServiceWindow "analysis_service :$($servicePorts['ANALYSIS_SERVICE_PORT'])" "$pySetup; `$env:PORT='$($servicePorts['ANALYSIS_SERVICE_PORT'])'; uvicorn services.analysis_service.app:app --host 0.0.0.0 --port $($servicePorts['ANALYSIS_SERVICE_PORT'])$reloadFlag"
Start-ServiceWindow "reporting_service :$($servicePorts['REPORTING_SERVICE_PORT'])" "$pySetup; `$env:PORT='$($servicePorts['REPORTING_SERVICE_PORT'])'; uvicorn services.reporting_service.app:app --host 0.0.0.0 --port $($servicePorts['REPORTING_SERVICE_PORT'])$reloadFlag"
Start-ServiceWindow "pipeline_orchestrator :$($servicePorts['PIPELINE_ORCHESTRATOR_PORT'])" "$pySetup; `$env:PORT='$($servicePorts['PIPELINE_ORCHESTRATOR_PORT'])'; uvicorn pipeline_orchestrator.app:app --host 0.0.0.0 --port $($servicePorts['PIPELINE_ORCHESTRATOR_PORT'])$reloadFlag"
Start-ServiceWindow "pipeline_worker" "$pySetup; python -m pipeline_orchestrator.worker"
Start-ServiceWindow "annual-report-backend :$($servicePorts['ANNUAL_REPORT_BACKEND_PORT'])" "$pySetup; `$env:PORT='$($servicePorts['ANNUAL_REPORT_BACKEND_PORT'])'; python services/annual-report-backend/api_server.py"
Start-ServiceWindow "nodeBackend :$($servicePorts['NODE_BACKEND_PORT'])" "Set-Location '$repoRoot/nodeBackend'; `$env:PORT='$($servicePorts['NODE_BACKEND_PORT'])'; npm run dev"

Write-Host "All services started from central .env."
Write-Host "Ports:"
foreach ($entry in $servicePorts.GetEnumerator() | Sort-Object Name) {
    Write-Host "  $($entry.Name)=$($entry.Value)"
}
