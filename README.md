# PLC Report Analyzer BZL

Last updated: 2026-05-26

Enterprise annual report analysis platform with a Node API gateway, Python pipeline services, Redis-backed transient artifacts, and generated analytical outputs (JSON plus styled PDF).

## Current System Architecture

The system operates under a strict "Data First" architecture, where algorithmic validation rules enforce data correctness and AI is treated as an extraction assistant governed by strict structural boundaries. 

The pipeline ensures high accuracy through multi-extactor reconciliation, cross-statement validation, and absolute gateway checks before progressing to analytics.

### Active Services and Ports

| System | Running Port | Purpose |
|---|---:|---|
| nodeBackend | 3000 | Primary API entry, upload orchestration, pipeline monitoring, and state governance |
| extraction_service | 8001 | PDF extraction executing multi-extractor voting and cross-statement reconciliation |
| analysis_service | 8002 | Coverage scoring gates, accounting validation, advanced reporting & analytical logic |
| reporting_service | 8003 | Final narrative composition and professional PDF report generation |
| pipeline_orchestrator | 8100 | Queue-oriented job submission, status tracking, and result handling |
| annual-report-backend | 5000 | Auxiliary annual-report processing backend |
| pipeline_worker | no port | Background worker consuming orchestrator queue jobs |

## End-to-End Execution Flow

### 1. Environment and Dependencies

1. Create and activate virtual environment:
`powershell
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
`

2. Create central environment file:
`powershell
Copy-Item .env.sample .env
`
Ensure all port and provider keys (e.g., GEMINI_API_KEY) are assigned correctly.

### 2. Services Initialization

Use the central launcher script to bootstrap the full backend stack:
`powershell
.\scripts\start_services.ps1
`
*(Optionally include -NoReload in production/staging environments)*

### 3. Pipeline Processing Stages

To ensure deterministic reliability, the backend orchestrates operations across granular, globally reported stages:

1. **DOCUMENT_INGESTION**: Uploaded pipeline ingestion.
2. **PAGE_CLASSIFICATION**: Classifying document segments and structure.
3. **STATEMENT_DETECTION**: Identifying financial structures and bounds.
4. **MULTI_EXTRACTOR_EXECUTION**: Executing specialized extractors (Balance Sheet, Cash Flow, Income, ESG, etc.) backed by \platform_core\.
5. **CROSS_EXTRACTOR_RECONCILIATION**: Normalizing cross-linked entries and ensuring values align.
6. **ACCOUNTING_VALIDATION**: Mathematical integrity verification (e.g., balance sheet identity).
7. **COVERAGE_SCORING_GATE**: Strict hard-gate preventing unvalidated metrics from entering the reporting layer.
8. **FINANCIAL_ANALYSIS**: Engine derivations for ratios, risk signals, and patterns.
9. **REPORT_GENERATION**: PDF structuring, final data aggregation, and finalization.

### 4. System Output State Contract

The nodeBackend governs the frontend's visual state through a mutually-exclusive global output phase:
- **PROCESSING**: Dashboard renders live Pipeline Monitor (stages, statuses, progress logs) without prematurely showing metrics.
- **EXTRACTION_INCOMPLETE**: Triggered when extraction fails the coverage or accounting gate. Interface delegates to an Extraction Audit Report detailing missing/failed equations without generating falsified analytics.
- **VALIDATED_READY**: Pipeline succeeded, unlocking full analytics rendering, charting, and report PDF retrieval.

### Analytical and Domain Controls
1. Balance sheet & identity assertions
2. Standardized LKR normalization limits
3. Cross-statement net income verification
4. Chronological aggregation validation
5. Fallback heuristics for non-machine-readable documents

## Frontend Ecosystem

The platform exposes pipeline interactions through multiple clients:
1. **mobile** (React Native / Expo app): Full flow interface optimized for mobile presentation. Start via \cd mobile; npm install; npm start\.
2. **frontend** (Vite React app): Standard web application for extensive auditing.
3. **frontend_I** (Legacy Vite React app): Alternate dashboard view interface.

## Repository Focus Areas & Design

- \platform_core/\: Shared backend architecture, interfaces, utilities, and infrastructure ensuring DRY principles across all python extractors.
- \alance_sheet_extractor, cashflow_statement_extractor, esg_extractor, risk_extractor\, etc.: Micro-domain extraction endpoints.
- \
odeBackend/\: Express API gateway, deterministic state reporting (\pipelineContract\), and web routing.
- \pipeline_orchestrator/\: Redised Async job execution workflows.

*All services utilize Redis for transient artifact storage and orchestration progression. Output analytical documents are collected permanently and temporarily stored financial segments are deleted post-run.*
