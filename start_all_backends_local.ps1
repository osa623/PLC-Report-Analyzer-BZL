param(
    [switch]$InstallDeps,
    [switch]$SkipNode,
    [switch]$ForceReinstallDeps,
    [int]$DbPort = 5432,
    [string]$DbHost = "localhost",
    [string]$DbName = "cse_finance",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "buyzonlab123",
    [string]$RedisHost = "127.0.0.1",
    [int]$RedisPort = 6379,
    [int]$RedisDb = 0
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
$localRedisUrl = "redis://{0}:{1}/{2}" -f $RedisHost, $RedisPort, $RedisDb

$dbReachable = (Test-NetConnection -ComputerName $DbHost -Port $resolvedDbPort -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $dbReachable) {
    throw "Database is not reachable at $DbHost`:$resolvedDbPort. Start PostgreSQL or pass correct -DbHost/-DbPort."
}

Write-Host ("Using DB: {0}:{1}/{2} (user {3})" -f $DbHost, $resolvedDbPort, $DbName, $DbUser) -ForegroundColor Cyan

$redisReachable = (Test-NetConnection -ComputerName $RedisHost -Port $RedisPort -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $redisReachable) {
    Write-Warning "Redis is not reachable at $RedisHost`:$RedisPort. Services will start, but extraction/report generation can fail until Redis is available."
}
else {
    Write-Host ("Using Redis: {0}:{1} (db {2})" -f $RedisHost, $RedisPort, $RedisDb) -ForegroundColor Cyan
}

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

function Wait-ForPortReady {
    param(
        [string]$TargetHost,
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $reachable = (Test-NetConnection -ComputerName $TargetHost -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
        if ($reachable) {
            return $true
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

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
    $prevRedisUrl = $env:REDIS_URL
    $env:DATABASE_URL = $localDbUrl
    $env:REDIS_URL = $localRedisUrl
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

        if ($null -eq $prevRedisUrl) {
            Remove-Item Env:REDIS_URL -ErrorAction SilentlyContinue
        }
        else {
            $env:REDIS_URL = $prevRedisUrl
        }
    }

    $started += [pscustomobject]@{
        service = $ServiceName
        port = $Port
        pid = $proc.Id
        log = $logFile
        err = $errFile
    }

    $isReady = Wait-ForPortReady -TargetHost "127.0.0.1" -Port $Port -TimeoutSeconds 30
    if (-not $isReady) {
        Write-Warning ("{0} did not open :{1} within timeout; it may still be initializing." -f $ServiceName, $Port)
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
                $tempRoot = Join-Path $root "temp"
                $npmCache = Join-Path $tempRoot "npm-cache"
                if (-not (Test-Path $tempRoot)) {
                    New-Item -ItemType Directory -Path $tempRoot | Out-Null
                }
                if (-not (Test-Path $npmCache)) {
                    New-Item -ItemType Directory -Path $npmCache | Out-Null
                }

                $prevTmp = $env:TMP
                $prevTemp = $env:TEMP
                $prevNpmCache = $env:npm_config_cache
                $env:TMP = $tempRoot
                $env:TEMP = $tempRoot
                $env:npm_config_cache = $npmCache

                try {
                    npm install
                }
                finally {
                    if ($null -eq $prevTmp) { Remove-Item Env:TMP -ErrorAction SilentlyContinue } else { $env:TMP = $prevTmp }
                    if ($null -eq $prevTemp) { Remove-Item Env:TEMP -ErrorAction SilentlyContinue } else { $env:TEMP = $prevTemp }
                    if ($null -eq $prevNpmCache) { Remove-Item Env:npm_config_cache -ErrorAction SilentlyContinue } else { $env:npm_config_cache = $prevNpmCache }
                }
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

        $nodeReady = Wait-ForPortReady -TargetHost "127.0.0.1" -Port 3000 -TimeoutSeconds 30
        if (-not $nodeReady) {
            Write-Warning "node_orchestrator did not open :3000 within timeout; it may still be initializing."
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
