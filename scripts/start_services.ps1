param()

# Starts services in separate PowerShell windows (uses the repo venv)
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$venv = Join-Path $root ".venv\Scripts\Activate.ps1"
if (-Not (Test-Path $venv)) {
    Write-Error "Virtualenv activate script not found at $venv. Create venv and install requirements first."
    exit 1
}

function Start-ServiceWindow($name, $modulePath, $host, $port) {
    $cmd = "& `$env:LOCALAPPDATA\Programs\PowerShell\7\pwsh.exe -NoExit -Command `"Set-Location '$root'; . '$venv'; $env:PYTHONPATH='$root'; uvicorn $modulePath:app --host $host --port $port --reload`""
    # Try with Windows PowerShell if pwsh not available
    Start-Process -FilePath powershell -ArgumentList "-NoExit","-Command","Set-Location '$root'; . '$venv'; $env:PYTHONPATH='$root'; uvicorn $modulePath:app --host $host --port $port --reload" -WindowStyle Normal -Verb RunAs
    Write-Host "Started $name on $host:$port"
}

Start-ServiceWindow "extraction_service" "services.extraction_service.app" "0.0.0.0" 8001
Start-ServiceWindow "analysis_service" "services.analysis_service.app" "0.0.0.0" 8200
Start-ServiceWindow "pipeline_orchestrator" "pipeline_orchestrator.app" "0.0.0.0" 8110
Start-ServiceWindow "reporting_service" "services.reporting_service.app" "0.0.0.0" 8300

Write-Host "All start commands issued. Check service windows for logs."
