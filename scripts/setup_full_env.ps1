<#
Set up local dev environment for end-to-end pipeline testing.
This script will:
- copy .env.sample to .env (asks before overwriting)
- install Python deps for extraction service into the repo venv
- start Redis and Postgres via docker-compose

Run from repo root with PowerShell:
  .\scripts\setup_full_env.ps1 -InstallDeps -StartInfra
#>
param(
    [switch]$InstallDeps,
    [switch]$StartInfra
)

Push-Location $PSScriptRoot\..\

if (-not (Test-Path ".env.sample")) {
    Write-Error ".env.sample not found in repository root."
    Pop-Location
    exit 2
}

if (-not (Test-Path ".env")) {
    Copy-Item -Path .env.sample -Destination .env
    Write-Output "Created .env from .env.sample (edit secrets before running services)."
} else {
    Write-Output ".env already exists; not overwriting. Edit .env to add credentials."
}

if ($InstallDeps) {
    if (Test-Path ".venv\Scripts\python.exe") {
        Write-Output "Installing Python dependencies into .venv..."
        .\.venv\Scripts\python.exe -m pip install -r services\extraction_service\requirements.txt
    } else {
        Write-Output "No .venv found. Creating a venv named .venv and installing dependencies..."
        python -m venv .venv
        .\.venv\Scripts\python.exe -m pip install --upgrade pip
        .\.venv\Scripts\python.exe -m pip install -r services\extraction_service\requirements.txt
    }
}

if ($StartInfra) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker not found in PATH. Install Docker Desktop or Docker Engine to run local infra."
        Pop-Location
        exit 3
    }

    Write-Output "Starting Redis and Postgres via docker-compose..."
    docker compose up -d
}

Write-Output "Setup complete. Ensure you edit .env with real credentials before running the services."
Pop-Location
