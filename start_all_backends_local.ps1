param(
    [switch]$InstallDeps,
    [switch]$SkipNode,
    [switch]$ForceReinstallDeps,
    [int]$DbPort = 5432,
    [string]$DbHost = "localhost",
    [string]$DbName = "cse_finance",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "buyzonlab123"
)

$ErrorActionPreference = "Stop"
$dbPortExplicit = $PSBoundParameters.ContainsKey("DbPort")

$root = $PSScriptRoot
$logsDir = Join-Path $root "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

function Resolve-DbPort {
    param(
        [int]$RequestedPort,
        [bool]$IsExplicit
    )

    if ($IsExplicit) {
        return $RequestedPort
    }

    $requestedOpen = (Test-NetConnection -ComputerName $DbHost -Port $RequestedPort -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($requestedOpen) {
        return $RequestedPort
    }

    $pgProcIds = Get-Process -Name postgres -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
    if (-not $pgProcIds) {
        return $RequestedPort
    }

    $detectedPorts = Get-NetTCPConnection -State Listen -OwningProcess $pgProcIds -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty LocalPort -Unique |
        Sort-Object

    if ($detectedPorts) {
        return [int]$detectedPorts[0]
    }

    return $RequestedPort
}

$resolvedDbPort = Resolve-DbPort -RequestedPort $DbPort -IsExplicit $dbPortExplicit

# Local DB override for all services (non-docker run)
$localDbUrl = "postgresql+psycopg2://{0}:{1}@{2}:{3}/{4}" -f $DbUser, $DbPassword, $DbHost, $resolvedDbPort, $DbName
$localNodeDbUrl = "postgresql://{0}:{1}@{2}:{3}/{4}" -f $DbUser, $DbPassword, $DbHost, $resolvedDbPort, $DbName

$dbReachable = (Test-NetConnection -ComputerName $DbHost -Port $resolvedDbPort -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $dbReachable) {
    throw "Database is not reachable at $DbHost`:$resolvedDbPort. Start PostgreSQL or pass correct -DbHost/-DbPort."
}

Write-Host ("Using DB: {0}:{1}/{2} (user {3})" -f $DbHost, $resolvedDbPort, $DbName, $DbUser) -ForegroundColor Cyan

$pythonServices = @(
    @{ Name = "document_parser"; Port = 8001 },
    @{ Name = "structure_detector"; Port = 8002 },
    @{ Name = "financial_statement_extractor"; Path = "income_statement_extractor"; Port = 8003 },
    @{ Name = "balance_sheet_extractor"; Port = 8004 },
    @{ Name = "cashflow_extractor"; Path = "cashflow_statement_extractor"; Port = 8005 },
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

function Ensure-PythonEnvironment {
    param(
        [string]$ServiceName,
        [string]$ServicePath
    )

    $venvPath = Join-Path $ServicePath ".venv"
    $venvPython = Join-Path $venvPath "Scripts\python.exe"
    $reqFile = Join-Path $ServicePath "requirements.txt"
    $depsMarker = Join-Path $venvPath ".deps_installed"

    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating virtual environment for $ServiceName ..." -ForegroundColor Cyan
        if (Get-Command py -ErrorAction SilentlyContinue) {
            $null = & py -3 -m venv $venvPath
        }
        else {
            $null = & python -m venv $venvPath
        }
    }

    if (-not (Test-Path $venvPython)) {
        throw "Could not create Python virtual environment for $ServiceName"
    }

    $shouldInstall = $ForceReinstallDeps -or $InstallDeps -or ((Test-Path $reqFile) -and (-not (Test-Path $depsMarker)))
    if ($shouldInstall -and (Test-Path $reqFile)) {
        Write-Host "Installing deps for $ServiceName ..." -ForegroundColor Cyan
        Push-Location $ServicePath
        try {
            $null = & $venvPython -m pip install --upgrade pip
            $null = & $venvPython -m pip install -r requirements.txt
            Set-Content -Path $depsMarker -Value (Get-Date -Format "o") -Encoding UTF8 | Out-Null
        }
        finally {
            Pop-Location
        }
    }

    return [string]$venvPython
}

function Start-PythonService {
    param(
        [string]$ServiceName,
        [string]$ServicePathOverride,
        [int]$Port,
        [switch]$Install
    )

    $serviceFolder = if ([string]::IsNullOrWhiteSpace($ServicePathOverride)) { $ServiceName } else { $ServicePathOverride }
    $servicePath = Join-Path $root $serviceFolder
    if (-not (Test-Path $servicePath)) {
        Write-Warning "Skipping $ServiceName (folder '$serviceFolder' not found)."
        return
    }

    $pythonExe = Ensure-PythonEnvironment -ServiceName $ServiceName -ServicePath $servicePath

    $logFile = Join-Path $logsDir ("{0}.log" -f $ServiceName)
    $errFile = Join-Path $logsDir ("{0}.err.log" -f $ServiceName)

    $prevDbUrl = $env:DATABASE_URL
    $env:DATABASE_URL = $localDbUrl
    try {
        $proc = Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$Port" -WorkingDirectory $servicePath -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $errFile
    }
    finally {
        if ($null -eq $prevDbUrl) {
            Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
        }
        else {
            $env:DATABASE_URL = $prevDbUrl
        }
    }

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

        if ($InstallDeps -or $ForceReinstallDeps -or (-not (Test-Path (Join-Path $nodePath "node_modules")))) {
            Write-Host "Installing Node deps for nodeBackend ..." -ForegroundColor Cyan
            Push-Location $nodePath
            try {
                npm install
            }
            finally {
                Pop-Location
            }
        }

        $prevNodeDbUrl = $env:DATABASE_URL
        $env:DATABASE_URL = $localNodeDbUrl
        try {
            $nodeProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" -WorkingDirectory $nodePath -PassThru -RedirectStandardOutput $nodeLog -RedirectStandardError $nodeErr
        }
        finally {
            if ($null -eq $prevNodeDbUrl) {
                Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
            }
            else {
                $env:DATABASE_URL = $prevNodeDbUrl
            }
        }

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
    Start-PythonService -ServiceName $svc.Name -ServicePathOverride $svc.Path -Port $svc.Port -Install:$InstallDeps
}

$pidFile = Join-Path $root "backend_pids.json"
$started | ConvertTo-Json | Set-Content -Encoding UTF8 $pidFile

Write-Host "" 
Write-Host "All requested backends launched (non-docker mode)." -ForegroundColor Cyan
Write-Host "PID file: $pidFile"
Write-Host "Logs folder: $logsDir"
Write-Host "" 
Write-Host "Tip: use stop_all_backends_local.ps1 to stop them cleanly." -ForegroundColor Yellow
Write-Host "Run once command: .\start_all_backends_local.ps1" -ForegroundColor Yellow
