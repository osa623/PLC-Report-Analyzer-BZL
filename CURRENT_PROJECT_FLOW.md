# Current Project Flow (Completed, As Implemented)

This document reflects the current implemented runtime flow in this repository, including single-report orchestration and batch comparative analysis.

## 1. Public API Entry Points (Node Orchestrator)

Routes source: `nodeBackend/src/routes/reportRoutes.js`

1. `POST /reports`
  - Multipart field: `report` (single PDF)
  - Metadata fields: `symbol`, `name`, `sector`
2. `POST /reports/batch`
  - Multipart field: `reports` (multiple PDFs, max 10)
  - Metadata fields: `symbol`, `name`, `sector`
3. `GET /reports/:reportId`
  - Returns report DB metadata + workflow state
4. `GET /reports/batch/:batchId`
  - Fetches comparative batch output from `comparative_analysis`

Controller source: `nodeBackend/src/controllers/reportController.js`

## 2. Single Report Flow (POST /reports)

Service source: `nodeBackend/src/services/reportService.js`

`uploadAndAnalyze` execution:

1. Create upload directory if missing.
2. Save uploaded PDF to `nodeBackend/uploads` using absolute path (`path.resolve`).
3. Upsert company in Postgres (`companies`).
4. Create report row in Postgres (`reports`) with initial state `UPLOADED`.
5. Execute pipeline synchronously via `pipelineEngine.execute({ reportId, filePath })`.
6. Return:
  - `report` (DB row)
  - `generatedReport` (response from `report_generator`)

## 3. Batch Flow with Comparative Analysis (POST /reports/batch)

Service source: `nodeBackend/src/services/reportService.js`

`batchUploadAndAnalyze` execution:

1. Validate upload list exists and is `<= 10` files.
2. Upsert one company record for the batch metadata.
3. For each uploaded file (sequentially):
  - Save to disk
  - Create report row in Postgres
  - Run full pipeline
  - Record success/failure per file in `reports[]`
4. Collect successful `reportIds`.
5. Call `comparative_analysis` endpoint `POST /analyze-comparative` with:
  - `batch_id`
  - `report_ids`
  - `company: { symbol, name, sector }`
6. Return batch response:
  - `batchId`
  - `totalFiles`
  - `completedReports`
  - `reports` (per-file status)
  - `comparativeAnalysis` (status from comparative service)

Batch result retrieval:

- `GET /reports/batch/:batchId` internally calls `comparative_analysis` `POST /get-batch-result`.
- If not present, Node returns `404` (`Batch result not found`).

## 4. Workflow States (Per Report)

State enum source: `nodeBackend/src/workflow/states.js`

1. `UPLOADED`
2. `PARSING`
3. `EXTRACTING`
4. `ANALYZING`
5. `GENERATING_REPORT`
6. `COMPLETED`
7. `FAILED`

## 5. Pipeline Engine Behavior

Source: `nodeBackend/src/workflow/pipelineEngine.js`

### 5.1 Participating calls

1. `document_parser` -> `POST /parse-document`
  - Must return `status = parsed`
2. `structure_detector` -> `POST /detect-structure`
3. `financial_statement_extractor` -> `POST /extract-financials`
4. `balance_sheet_extractor` -> `POST /extract-financials`
5. `cashflow_extractor` -> `POST /extract-financials`
6. `segment_extractor` -> `POST /extract-financials`
7. `governance_extractor` -> `POST /extract-governance`
8. `risk_extractor` -> `POST /extract-risk`
9. `esg_extractor` -> `POST /extract-esg`
10. `ratio_calculator` -> `POST /calculate-ratios`
11. `strategy_nlp` -> `POST /extract-strategy`
12. `kpi_sector_engine` -> `POST /sector-kpis`
13. `pattern_detection` -> `POST /detect-patterns`
14. `report_generator` -> `POST /generate-report`
  - Must return `status = completed`

### 5.2 Participation mode

Pipeline supports two runtime modes via `PIPELINE_STRICT_ALL_BACKENDS`:

1. `false` (default, resilient mode)
  - Participating analysis/extraction services run as best-effort.
  - Failures/timeouts are logged, but pipeline continues.
  - `document_parser` and `report_generator` remain hard-required.
2. `true` (strict mode)
  - All participating services are fail-fast required.
  - Any participating service failure moves report to `FAILED`.

## 6. Service Registry (Local Defaults)

Source: `nodeBackend/src/config/serviceRegistry.js`

- `document_parser` -> `http://localhost:8001`
- `structure_detector` -> `http://localhost:8002`
- `financial_statement_extractor` -> `http://localhost:8003`
- `balance_sheet_extractor` -> `http://localhost:8004`
- `cashflow_extractor` -> `http://localhost:8005`
- `ratio_calculator` -> `http://localhost:8006`
- `segment_extractor` -> `http://localhost:8007`
- `governance_extractor` -> `http://localhost:8008`
- `risk_extractor` -> `http://localhost:8009`
- `esg_extractor` -> `http://localhost:8010`
- `strategy_nlp` -> `http://localhost:8011`
- `kpi_sector_engine` -> `http://localhost:8012`
- `pattern_detection` -> `http://localhost:8013`
- `report_generator` -> `http://localhost:8014`
- `comparative_analysis` -> `http://localhost:8015`

## 7. Timeout and Retry Behavior

Sources:

- `nodeBackend/src/workflow/pipelineEngine.js`
- `nodeBackend/src/clients/serviceClient.js`

Current values:

1. Required timeout: `300000 ms`
2. Best-effort timeout: `300000 ms`
3. Retry attempts per service request: `3`
4. Retriable error codes: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`
5. Retry delay: `1500 ms`

## 8. Redis Runtime Data Layout

Primary key prefix is `report`.

Per-report keys commonly used:

- `report:{report_id}`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:final_report`

Batch comparative key:

- `report:batch:{batch_id}:comparative`

Comparative service stores batch output with TTL (`redis_ttl_seconds`, default `900`).

## 9. Comparative Analysis Output (Batch)

Comparative sources:

- `comparative_analysis/api/routes.py`
- `comparative_analysis/services/comparative_service.py`
- `comparative_analysis/models/schemas.py`

Generated structure includes:

- `batch_id`
- `company`
- `status`
- `metric_trends`
- `growth_analysis`
- `investment_signals`
- `dupont_analysis`
- `financial_health`
- `cashflow_breakdown`
- `ratio_comparison`
- `risk_heatmap`
- `years_analyzed`
- `report_ids`

## 10. Local Non-Docker Startup Flow

Launcher source: `start_all_backends_local.ps1`

Current startup behavior:

1. Resolve DB host/port and validate connectivity.
2. Validate Redis connectivity (warn if unavailable).
3. Start Node orchestrator on `:3000`.
4. Start Python services on `:8001..:8015` (includes `comparative_analysis`).
5. Wait for each service port.
6. Persist process metadata to `backend_pids.json`.

## 11. Completed End-to-End Characteristics

1. Single report flow is synchronous and returns pipeline result directly.
2. Batch flow executes report pipelines per file, then performs comparative aggregation.
3. Per-report completion depends on successful completion of all participating backends.
4. Comparative batch result is Redis-backed and retrievable by `batchId`.
5. Redis-backed artifacts are time-bound (TTL), so durable storage should be added if long retention is required.
