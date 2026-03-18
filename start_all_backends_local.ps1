param(
    [switch]$InstallDeps,
    [switch]$SkipNode
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$logsDir = Join-Path $root "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Local DB override for all services (non-docker run)
$localDbUrl = "postgresql+psycopg2://postgres:postgres@localhost:5432/cse_finance"

$pythonServices = @(
    @{ Name = "document_parser"; Port = 8001 },
    @{ Name = "structure_detector"; Port = 8002 },
    @{ Name = "financial_statement_extractor"; Port = 8003 },
    @{ Name = "balance_sheet_extractor"; Port = 8004 },
    @{ Name = "cashflow_extractor"; Port = 8005 },
    @{ Name = "ratio_calculator"; Port = 8006 },
    @{ Name = "segment_extractor"; Port = 8007 },
    @{ Name = "governance_extractor"; Port = 8008 },
    @{ Name = "risk_extractor"; Port = 8009 },
    @{ Name = "esg_extractor"; Port = 8010 },
    @{ Name = "strategy_nlp"; Port = 8011 },
    @{ Name = "kpi_sector_engine"; Port = 8012 },
    @{ Name = "pattern_detection"; Port = 8013 },
    @{ Name = "report_generator"; Port = 8014 }
)

$started = @()

function Start-PythonService {
    param(
        [string]$ServiceName,
        [int]$Port,
        [switch]$Install
    )

    $servicePath = Join-Path $root $ServiceName
    if (-not (Test-Path $servicePath)) {
        Write-Warning "Skipping $ServiceName (folder not found)."
        return
    }

    $venvPython = Join-Path $servicePath ".venv\Scripts\python.exe"
    $pythonExe = if (Test-Path $venvPython) { $venvPython } else { "python" }

    if ($Install) {
        $reqFile = Join-Path $servicePath "requirements.txt"
        if (Test-Path $reqFile) {
            Write-Host "Installing deps for $ServiceName ..." -ForegroundColor Cyan
            Push-Location $servicePath
            try {
                & $pythonExe -m pip install -r requirements.txt
            }
            finally {
                Pop-Location
            }
        }
    }

    $logFile = Join-Path $logsDir ("{0}.log" -f $ServiceName)
    $errFile = Join-Path $logsDir ("{0}.err.log" -f $ServiceName)

    $cmd = @(
        "`$env:DATABASE_URL='$localDbUrl'",
        "Set-Location '$servicePath'",
        "& '$pythonExe' -m uvicorn main:app --host 0.0.0.0 --port $Port"
    ) -join "; "

    $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $errFile

    $started += [pscustomobject]@{
        service = $ServiceName
        port = $Port
        pid = $proc.Id
        log = $logFile
        err = $errFile
    }

    Write-Host ("Started {0} on :{1} (PID {2})" -f $ServiceName, $Port, $proc.Id) -ForegroundColor Green
}

if (-not $SkipNode) {
    $nodePath = Join-Path $root "nodeBackend"
    if (Test-Path $nodePath) {
        $nodeLog = Join-Path $logsDir "node_orchestrator.log"
        $nodeErr = Join-Path $logsDir "node_orchestrator.err.log"

        if ($InstallDeps) {
            Write-Host "Installing Node deps for nodeBackend ..." -ForegroundColor Cyan
            Push-Location $nodePath
            try {
                npm install
            }
            finally {
                Pop-Location
            }
        }

        $nodeCmd = @(
            "`$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/cse_finance'",
            "Set-Location '$nodePath'",
            "npm run dev"
        ) -join "; "

        $nodeProc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $nodeCmd -PassThru -RedirectStandardOutput $nodeLog -RedirectStandardError $nodeErr

        $started += [pscustomobject]@{
            service = "node_orchestrator"
            port = 3000
            pid = $nodeProc.Id
            log = $nodeLog
            err = $nodeErr
        }

        Write-Host ("Started node_orchestrator on :3000 (PID {0})" -f $nodeProc.Id) -ForegroundColor Green
    }
    else {
        Write-Warning "Skipping node_orchestrator (nodeBackend folder not found)."
    }
}

foreach ($svc in $pythonServices) {
    Start-PythonService -ServiceName $svc.Name -Port $svc.Port -Install:$InstallDeps
}

$pidFile = Join-Path $root "backend_pids.json"
$started | ConvertTo-Json | Set-Content -Encoding UTF8 $pidFile

Write-Host "" 
Write-Host "All requested backends launched (non-docker mode)." -ForegroundColor Cyan
Write-Host "PID file: $pidFile"
Write-Host "Logs folder: $logsDir"
Write-Host "" 
Write-Host "Tip: use stop_all_backends_local.ps1 to stop them cleanly." -ForegroundColor Yellow
