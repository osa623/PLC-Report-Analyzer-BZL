# PLC Report Analyzer BZL

Last updated: 2026-04-18

Enterprise annual report analysis platform with a Node API gateway, Python pipeline services, Redis-backed transient artifacts, and generated analytical outputs (JSON plus styled PDF).

## Current System (As of 2026-04-18)

This repository currently runs as a six-port service stack plus one background worker:

1. Node API gateway for upload, orchestration, and consolidated retrieval
2. Extraction service for PDF-to-financial statement extraction
3. Analysis service for validation gates, ratios, risk, patterns, and confidence
4. Reporting service for narrative assembly and PDF generation
5. Pipeline orchestrator API for queued job submission and retrieval
6. Annual-report backend for auxiliary annual-report processing
7. Pipeline worker (no HTTP port) that consumes queued orchestrator jobs

## Active Services and Ports

| System | Running Port | Purpose |
|---|---:|---|
| nodeBackend | 3000 | Primary API entry, upload orchestration, and consolidated pipeline data retrieval |
| extraction_service | 8001 | PDF extraction into canonical financial and narrative structures |
| analysis_service | 8002 | Validation gates, scale harmonization, ratios, patterns, confidence, and risk scoring |
| reporting_service | 8003 | Final narrative composition and professional PDF report generation |
| pipeline_orchestrator | 8100 | Queue-oriented job submission, status tracking, and result handling |
| annual-report-backend | 5000 | Auxiliary annual-report processing backend |
| pipeline_worker | no port | Background worker that consumes orchestrator queue jobs |

## End-to-End System Procedure

### 1. Environment and dependencies

1. Create and activate virtual environment:

```powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Create central environment file:

```powershell
Copy-Item .env.sample .env
```

3. Ensure these variables are set in .env:
- REDIS_URL
- DATABASE_URL (or Mongo settings when applicable)
- GEMINI_API_KEY and any required provider keys
- NODE_BACKEND_PORT
- EXTRACTION_SERVICE_PORT
- ANALYSIS_SERVICE_PORT
- REPORTING_SERVICE_PORT
- PIPELINE_ORCHESTRATOR_PORT
- ANNUAL_REPORT_BACKEND_PORT

### 2. Start infrastructure and services

Use the central launcher to start all services from one .env source:

```powershell
.\scripts\start_services.ps1
```

Optional (no auto-reload for FastAPI services):

```powershell
.\scripts\start_services.ps1 -NoReload
```

### 3. Verify services and ports

Run the built-in workspace task named check-service-ports.

### 4. Ingestion paths

Two supported operational paths are available:

1. Node API path (standard app flow)
- Upload one or multiple files through the Node gateway service on port 3000.
- Monitor pipeline stage progress, validated outputs, analytics outputs, and report artifacts through the same gateway service.

2. Orchestrator queue path (job-style flow)
- Submit files to the orchestrator service on port 8100.
- Poll job status and retrieve final job outputs via the orchestrator flow.

### 5. Analysis and report generation procedure

1. Extraction writes canonical raw data and temporary per-document financial artifacts.
2. Analysis merges per-document temporary data, harmonizes scale, runs hard gates, computes ratios/patterns/risk/confidence, and stores analytics artifacts.
3. Reporting composes sections, generates compact styled PDF, stores final report payload, and deletes temporary financial storage records.

### 6. Output artifacts

Primary artifacts are saved under data/eval, including:
- {report_id}.report.pdf
- report payload JSON artifacts
- benchmark/evaluation outputs

## Current Workflow States

The active workflow states returned by the Node pipeline tracker are:
- UPLOADED
- EXTRACTING
- ANALYZING
- GENERATING_REPORT
- COMPLETED
- LOW_CONFIDENCE
- FAILED

## Overall System Detail

### Core runtime flow
1. Ingestion and queueing: files are accepted by the gateway or orchestrator and registered for processing.
2. Extraction stage: statement and narrative candidates are extracted and stored as temporary artifacts.
3. Analysis stage: temporary artifacts are merged, normalized, validated with hard gates, and transformed into analytics.
4. Reporting stage: final sections and styled PDF are generated from validated analytics context.
5. Lifecycle completion: temporary financial storage records are deleted after final report generation.

### Analytical controls currently enforced
1. Balance sheet identity checks
2. Cash reconciliation checks
3. Cross-statement net income linkage checks
4. Multi-year continuity checks
5. Unit consistency checks

### Main produced outputs
1. Canonical validated financial dataset
2. Ratio engine outputs and trend diagnostics
3. Pattern and risk model outputs
4. Confidence and coverage summaries
5. Final report payload and generated PDF

## Frontend and Client Systems

1. frontend (Vite React app)
2. frontend_I (alternate/legacy Vite React app)
3. nodeBackend acts as the primary backend for frontend API calls

## Data and Storage Systems

1. Redis: transient pipeline artifacts and status
2. PostgreSQL: metadata and relational persistence where enabled
3. MongoDB: optional paths for selected components
4. Local filesystem: uploads and generated evaluation/report files

## Operational Notes

1. Always load one central .env before launching services.
2. Prefer scripts/start_services.ps1 for port consistency and env propagation.
3. If code changed but behavior did not, restart all services instead of relying on stale processes.
4. Keep financial statement values in LKR and avoid permanent storage of temporary extracted statement artifacts.

## Repository Focus Areas

- nodeBackend: API gateway and pipeline data endpoints
- services/extraction_service: extraction and temporary financial storage writes
- services/analysis_service: gates, normalization, analytics engines
- services/reporting_service: narrative composition and PDF generation
- pipeline_orchestrator: queue API and job lifecycle
- platform_core: shared contracts/infrastructure/utilities
- scripts: setup/start/diagnostic helpers
- docs: operations, observability, launch, rollback, privacy
- tests: step-based validation and regression suites
