<#
Safe PowerShell helper to create a local .env from .env.sample.
Usage: Run from the repo root:
  powershell -ExecutionPolicy Bypass -File .\scripts\setup_env.ps1
#>
$ErrorActionPreference = 'Stop'

$sample = Join-Path -Path (Get-Location) -ChildPath ".env.sample"
$target = Join-Path -Path (Get-Location) -ChildPath ".env"

if (-not (Test-Path $sample)) {
    Write-Error ".env.sample not found in the current directory ($(Get-Location))."
    exit 2
}

if (Test-Path $target) {
    $ans = Read-Host ".env already exists - overwrite? (y/N)"
    if ($ans -ne 'y' -and $ans -ne 'Y') {
        Write-Output "Aborting; .env unchanged."
        exit 0
    }
}

# perform the copy and verify
Copy-Item -Path $sample -Destination $target -Force -ErrorAction Stop
if (Test-Path $target) {
    Write-Output "Copied .env.sample -> .env"
    exit 0
} else {
    Write-Error "Failed to copy .env"
    exit 3
}
