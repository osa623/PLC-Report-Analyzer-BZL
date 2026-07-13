# PLC Report Analyzer BZL

Last updated: 2026-07-13

Financial reports analytics platform for PLC annual reports. The repository implements a validation-gated pipeline that ingests PDFs, extracts and normalizes financial statements, validates the data, computes ratios and risk signals, and generates narrative and PDF outputs with transparent scope and limitation reporting.

## Current System

This repository currently runs as a Node API gateway plus Python service modules and a background worker path:

1. Node API gateway for upload orchestration and consolidated retrieval
2. Extraction service for PDF parsing, structure detection, and canonical raw output
3. Analysis service for validation, normalization, ratios, patterns, confidence, and risk
4. Reporting service for narrative assembly and PDF generation
5. Pipeline orchestrator API for queued job submission and retrieval
6. Annual-report backend for auxiliary annual-report processing
7. Pipeline worker (no HTTP port) that consumes queued orchestrator jobs

## Active Services and Ports

| System | Running Port | Purpose |
|---|---:|---|
| nodeBackend | 3000 | Primary API entry, upload orchestration, and consolidated pipeline retrieval |
| extraction_service | 8001 | PDF parsing, structure detection, extraction, and canonical raw artifacts |
| analysis_service | 8002 | Validation gates, scale harmonization, ratios, patterns, confidence, and risk scoring |
| reporting_service | 8003 | Final narrative composition and professional PDF report generation |
| pipeline_orchestrator | 8100 | Queue-oriented job submission, status tracking, and result handling |
| annual-report-backend | 5000 | Auxiliary annual-report processing backend |
| pipeline_worker | no port | Background worker that consumes orchestrator queue jobs |

## Full Runtime Flow

The latest flow is validation-gated and data-first:

1. The frontend upload page calls `uploadReports(files)`.
2. `POST /api/reports` stores upload metadata and starts the pipeline.
3. The Node backend forwards the batch to the orchestrator path.
4. The orchestrator runs the core document flow:
	- document parsing
	- structure detection
	- parallel extraction
	- reconciliation and aggregation
	- validation gating
	- analytics computation
	- report generation
5. Extracted and validated artifacts are written to Redis and the local pipeline storage.
6. The Node API returns consolidated report, pipeline, raw, canonical, validated, analytics, and error responses.
7. The frontend renders progress, validation, and dashboard views from the backend status contract.

## Validation and Data Rules

1. The pipeline is not complete until the validated canonical dataset exists.
2. Analysis and reporting must use validated data, not partial extraction output.
3. Low-confidence or single-year runs still complete, but the UI must show the limitation explicitly.
4. Missing or incomplete inputs should appear as transparent pipeline state, not silent fallback data.

### Frontend state contract

The dashboard is driven by a single backend `pipeline_status` value:

- `PROCESSING`
- `EXTRACTION_INCOMPLETE`
- `VALIDATED_READY`

The frontend should only render analytics when `VALIDATED_READY` is present.

## Repository Architecture

### Backend and orchestration

- `nodeBackend/` - Express gateway, routes, orchestration, upload handling, and response shaping.
- `pipeline_orchestrator/` - queue-based job submission, status tracking, and batch execution.
- `services/annual-report-backend/` - auxiliary annual report processing backend.
- `services/company_service/` - company-related support logic.
- `platform_core/` - shared infrastructure for service bootstrap, jobs, storage, validation, and LLM access.

### Pipeline services

- `services/extraction_service/` - PDF parsing, page classification, structure detection, statement extraction, and canonical raw outputs.
- `services/analysis_service/` - normalization, validation, ratios, risk, patterns, confidence, and canonical validated outputs.
- `services/reporting_service/` - narrative composition, report assembly, and final PDF generation.

### Frontend and delivery

- `frontend/` - Vite React app with upload, processing, mapping, validation, and dashboard routes.
- `uploads/`, `outputs/`, `pipeline_artifacts/`, and `logs/` - file and runtime artifacts used by the pipeline.

### Shared assets and support

- `database/schema.sql` - relational schema definitions.
- `docs/` - architecture notes, runbooks, observability guides, privacy, and rollout material.
- `scripts/` - startup, health, and diagnostic scripts.
- `tests/` - regression and step-based validation suites.

## Key Data Artifacts

Primary Redis and pipeline artifacts include:

- `report:{report_id}:document_chunks`
- `report:{report_id}:structure`
- `report:{report_id}:canonical_raw`
- `report:{report_id}:canonical_validated`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:risk`
- `report:{report_id}:final_report`

Filesystem outputs commonly land under:

- `pipeline_artifacts/{report_id}/...`
- `logs/{company}/{timestamp}/...`
- `data/eval/` for final report and benchmark outputs when enabled

## Workflow States

The Node pipeline tracker currently uses these workflow states:

- `UPLOADED`
- `EXTRACTING`
- `ANALYZING`
- `GENERATING_REPORT`
- `COMPLETED`
- `LOW_CONFIDENCE`
- `FAILED`

## Service Endpoints and User Flows

1. Upload flow: `POST /api/reports`
2. Status flow: `GET /api/reports/:reportId`, `GET /api/pipeline/:reportId/stages`
3. Document inspection: `GET /api/pipeline/:reportId/documents`
4. Per-file detail: `GET /api/pipeline/:reportId/documents/:pdfName/data`
5. Retry flow: `POST /api/pipeline/:reportId/documents/:pdfName/retry-extraction`
6. Download flow: `GET /api/reports/:reportId/download`

## Setup and Run

1. Create and activate a Python virtual environment.
2. Install dependencies from `requirements.txt`.
3. Copy `.env.sample` to `.env` and set the required service URLs and provider keys.
4. Start services with `.\scripts\start_services.ps1`.
5. Verify ports with the `check-service-ports` workspace task.

## Operational Notes

1. Prefer `scripts/start_services.ps1` so all services use the same environment source.
2. Restart all services if code changes do not show up in behavior.
3. Keep temporary extracted statement artifacts out of permanent storage.
4. Preserve LKR values and report the reporting-year scope explicitly.

## Repository Focus Areas

- `nodeBackend`: API gateway, orchestration, and consolidated retrieval
- `services/extraction_service`: extraction, structure, and canonical raw artifacts
- `services/analysis_service`: validation, normalization, analytics, and scoring
- `services/reporting_service`: report generation and final outputs
- `pipeline_orchestrator`: queue API and job lifecycle
- `platform_core`: shared contracts and infrastructure
- `frontend`: UI, state-driven pipeline monitoring, and inspection
- `scripts`, `docs`, and `tests`: operations, architecture, and regression coverage
