param(
    [string]$BackendUrl = "http://localhost:3000",
    [string[]]$ReportPaths = @(
        "D:/PLC-Report-Analyzer-BZL/data/Banking_HNB_2022.pdf",
        "D:/PLC-Report-Analyzer-BZL/data/Banking_HNB_2023.pdf",
        "D:/PLC-Report-Analyzer-BZL/data/Banking_HNB_2024.pdf"
    ),
    [string]$Symbol = "HNB",
    [string]$Name = "Hatton National Bank PLC",
    [string]$Sector = "Banking",
    [int]$PollIntervalSeconds = 5,
    [int]$MaxWaitSeconds = 900,
    [switch]$VerboseOutput
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

function Invoke-CurlJson {
    param(
        [string[]]$CurlArgs,
        [string]$StepName
    )

    $raw = (& curl.exe @CurlArgs 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        $cmdPreview = "curl.exe " + ($CurlArgs -join " ")
        throw "curl failed during '$StepName' (exit code: $LASTEXITCODE). Command: $cmdPreview`nOutput: $raw"
    }

    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Empty response during '$StepName'."
    }

    try {
        return $raw | ConvertFrom-Json
    }
    catch {
        throw "Non-JSON response during '$StepName': $raw"
    }
}

function Assert-InputFiles {
    param([string[]]$Paths)

    if ($Paths.Count -eq 0) {
        throw "At least one PDF path is required."
    }

    $missing = @()
    foreach ($path in $Paths) {
        if (-not (Test-Path -LiteralPath $path)) {
            $missing += $path
        }
    }

    if ($missing.Count -gt 0) {
        throw "Missing input files:`n - " + ($missing -join "`n - ")
    }
}

function Get-QualityGateErrors {
    param($Result)

    if ($null -eq $Result.quality_gate) {
        return @()
    }

    if ($null -eq $Result.quality_gate.errors) {
        return @()
    }

    return @($Result.quality_gate.errors)
}

function Has-Property {
    param(
        $Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return $false
    }

    return $null -ne $Object.PSObject.Properties[$Name]
}

function Format-Readiness {
    param($Result)

    if ($null -eq $Result.report_readiness) {
        return @()
    }

    $lines = @()
    foreach ($item in @($Result.report_readiness)) {
        $reasons = @($item.reasons)
        if ($reasons.Count -eq 0) {
            $reasonsText = "none"
        }
        else {
            $reasonsText = $reasons -join ", "
        }

        $lines += "report_id=$($item.report_id); ready=$($item.ready); reasons=$reasonsText"
    }

    return $lines
}

try {
    Write-Section "Batch Smoke Test"
    Assert-InputFiles -Paths $ReportPaths

    Write-Host "Backend URL: $BackendUrl"
    Write-Host "Reports: $($ReportPaths.Count)"

    Write-Section "Create Batch"
    $createArgs = @("-s", "-S", "-X", "POST", "$BackendUrl/reports/batch")

    foreach ($path in $ReportPaths) {
        $createArgs += @("-F", "reports=@$path")
    }

    $createArgs += @("-F", "symbol=$Symbol")
    $createArgs += @("-F", "name=$Name")
    $createArgs += @("-F", "sector=$Sector")

    $createResponse = Invoke-CurlJson -CurlArgs $createArgs -StepName "create-batch"

    if ($null -eq $createResponse.batchId -or [string]::IsNullOrWhiteSpace([string]$createResponse.batchId)) {
        throw "No batchId returned. Response: $($createResponse | ConvertTo-Json -Depth 8 -Compress)"
    }

    $batchId = [string]$createResponse.batchId
    Write-Host "batchId: $batchId" -ForegroundColor Green

    Write-Section "Poll Batch Result"
    $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
    $latest = $null
    $batchResultSeen = $false

    while ((Get-Date) -lt $deadline) {
        $resultArgs = @("-s", "-S", "-X", "GET", "$BackendUrl/reports/batch/$batchId")
        $latest = Invoke-CurlJson -CurlArgs $resultArgs -StepName "get-batch-result"

        if ((Has-Property -Object $latest -Name "error") -and [string]$latest.error -eq "Batch result not found") {
            if ($VerboseOutput) {
                Write-Host "status=pending (batch result not ready yet)"
            }
            Start-Sleep -Seconds $PollIntervalSeconds
            continue
        }

        $batchResultSeen = $true

        if (-not (Has-Property -Object $latest -Name "status")) {
            throw "Batch result payload does not include 'status'. Payload: $($latest | ConvertTo-Json -Depth 8 -Compress)"
        }

        $status = [string]$latest.status
        if ($VerboseOutput) {
            $yearsCount = if (Has-Property -Object $latest -Name "years_analyzed") { @($latest.years_analyzed).Count } else { 0 }
            $trendsCount = if (Has-Property -Object $latest -Name "metric_trends") { @($latest.metric_trends).Count } else { 0 }
            Write-Host "status=$status years=$yearsCount trends=$trendsCount"
        }

        if ($status -in @("completed", "failed", "partial")) {
            break
        }

        Start-Sleep -Seconds $PollIntervalSeconds
    }

    if ($null -eq $latest -or -not $batchResultSeen) {
        throw "No batch result was returned before timeout."
    }

    $finalStatus = [string]$latest.status
    $qualityGateErrors = Get-QualityGateErrors -Result $latest
    $readinessLines = Format-Readiness -Result $latest

    Write-Section "Summary"
    Write-Host "batchId: $batchId"
    Write-Host "status: $finalStatus"
    $yearsCount = if (Has-Property -Object $latest -Name "years_analyzed") { @($latest.years_analyzed).Count } else { 0 }
    $trendsCount = if (Has-Property -Object $latest -Name "metric_trends") { @($latest.metric_trends).Count } else { 0 }
    $ratioKeyCount = 0
    if ((Has-Property -Object $latest -Name "ratio_comparison") -and $null -ne $latest.ratio_comparison) {
        if ($latest.ratio_comparison -is [System.Collections.IDictionary]) {
            $ratioKeyCount = @($latest.ratio_comparison.Keys).Count
        }
        elseif ($null -ne $latest.ratio_comparison.PSObject -and $null -ne $latest.ratio_comparison.PSObject.Properties) {
            $ratioKeyCount = @($latest.ratio_comparison.PSObject.Properties).Count
        }
    }
    $pdfPath = if (Has-Property -Object $latest -Name "pdf_path") { [string]$latest.pdf_path } else { "" }

    Write-Host "years_analyzed: $yearsCount"
    Write-Host "metric_trends: $trendsCount"
    Write-Host "ratio_comparison keys: $ratioKeyCount"
    Write-Host "pdf_path: $pdfPath"

    $qualityGateErrorsList = @($qualityGateErrors)
    if ($qualityGateErrorsList.Count -gt 0) {
        Write-Host "quality_gate_errors: $($qualityGateErrorsList -join ', ')" -ForegroundColor Yellow
    }

    $readinessLinesList = @($readinessLines)
    if ($readinessLinesList.Count -gt 0) {
        Write-Host "report_readiness:"
        foreach ($line in $readinessLinesList) {
            Write-Host " - $line"
        }
    }

    $hasPdf = -not [string]::IsNullOrWhiteSpace($pdfPath)
    $isPass = ($finalStatus -eq "completed" -and $hasPdf)

    if ($isPass) {
        Write-Host "`nRESULT: PASS" -ForegroundColor Green
        exit 0
    }

    Write-Host "`nRESULT: FAIL" -ForegroundColor Red
    exit 1
}
catch {
    Write-Host "`nRESULT: FAIL" -ForegroundColor Red
    $message = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = ($_ | Out-String).Trim()
    }
    Write-Host $message -ForegroundColor Red
    exit 1
}
