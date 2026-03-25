# Current Project Flow (As Implemented)

This document describes the currently implemented runtime flow end-to-end, including request handling, orchestration, storage, retries/timeouts, batch aggregation, and local startup scripts.

## 1. Runtime Topology

Core orchestrator:

- Node.js API (`nodeBackend`) is the entry point for uploads and report retrieval.
- It persists metadata/workflow state in Postgres and coordinates Python services over HTTP.

Specialized Python services:

- Parsing, extractors, analytics, and report generation run as separate FastAPI backends.
- `comparative_analysis` aggregates multiple completed reports into a batch-level comparative payload.

Data stores:

- Postgres: durable metadata (`companies`, `reports`).
- Redis: intermediate/final analysis payloads and batch comparative result (TTL-based).
- Local filesystem: uploaded PDFs and generated PDF outputs.

## 2. Public API Entry Points

Routes source: `nodeBackend/src/routes/reportRoutes.js`
Controller source: `nodeBackend/src/controllers/reportController.js`

1. `POST /reports`
   - Upload field: `report` (single PDF, multer memory storage).
   - Form fields: `symbol`, `name`, `sector`.
   - Returns `201` with:
     - `report`: created DB report row.
     - `generatedReport`: response from `report_generator /generate-report`.

2. `POST /reports/batch`
   - Upload field: `reports` (array, max 10).
   - Form fields: `symbol`, `name`, `sector`.
   - Generates `batchId` (UUID).
   - Returns `201` with:
     - `batchId`, `totalFiles`, `completedReports`
     - `consolidatedReport` (single multi-year result status/pdfPath)
     - `reports[]` (per-file status and pipeline result/error)
     - `comparativeAnalysis` (raw status payload from comparative service)

3. `GET /reports/:reportId`
   - Returns `200` with report + joined company fields.
   - Returns `404` if missing.

4. `GET /reports/batch/:batchId`
   - Pass-through to `comparative_analysis /get-batch-result`.
   - Returns `200` batch payload if found.
   - Returns `404` (`Batch result not found`) when comparative key is absent.

Related health endpoint:

- `GET /health` returns orchestrator status/environment.

## 3. Single Report Flow (`POST /reports`)

Primary service method: `ReportService.uploadAndAnalyze` (`nodeBackend/src/services/reportService.js`)

Execution path:

1. Ensure upload directory exists (`fs.mkdirSync(uploadDir, { recursive: true })`).
2. Generate UUID file name and preserve extension (default `.pdf`).
3. Write uploaded bytes from memory to disk at absolute path (`path.resolve`).
4. Upsert company by `symbol` in Postgres:
   - Insert or update `name`, `sector`.
5. Insert report row with initial workflow state `UPLOADED`.
6. Execute pipeline synchronously via `pipelineEngine.execute({ reportId, filePath })`.
7. Return the DB report row plus generator output.

Important behavior:

- This endpoint is synchronous from API perspective; caller waits for full pipeline completion/failure.

## 4. Batch Flow (`POST /reports/batch`)

Primary service method: `ReportService.batchUploadAndAnalyze`

Execution path:

1. Validate files are present and count is `<= 10`.
2. Upsert one company record for batch metadata.
3. Process files using worker concurrency, not sequentially:
   - Worker count = `min(BATCH_PIPELINE_CONCURRENCY, files.length)`.
   - Default `BATCH_PIPELINE_CONCURRENCY = 3`.
4. Per file:
   - Save PDF to disk.
   - Create report row in Postgres.
   - Run pipeline with `strictAllBackends: false` in batch mode.
   - If per-file PDF is generated, delete it (`cleanupSingleReportPdf`) because batch returns one consolidated multi-year PDF.
   - Record per-file success/failure in `reports[index]`.
5. Collect successful `reportIds`.
6. If at least one report succeeded:
   - Call `comparative_analysis /analyze-comparative` with:
     - `batch_id`
     - `report_ids`
     - `company: { symbol, name, sector }`
   - If comparative returns `status = completed`:
     - Call `report_generator /generate-batch-report`.
     - Build `consolidatedReport.status = completed` with `pdfPath`.
   - Else:
     - Build `consolidatedReport.status = failed` with quality-gate/failure message.
7. If no report succeeded:
   - `consolidatedReport.status = failed`, message `No report completed in batch`.
8. Return aggregate response.

Batch retrieval path (`GET /reports/batch/:batchId`):

1. Node calls `comparative_analysis /get-batch-result`.
2. If comparative payload exists but `pdf_path` is missing:
   - Node lazily triggers `report_generator /generate-batch-report` and injects `pdf_path`.
3. If comparative says `not_found` or call fails, Node returns `404`.

## 5. Workflow States (Per Report)

Source: `nodeBackend/src/workflow/states.js`

1. `UPLOADED`
2. `PARSING`
3. `EXTRACTING`
4. `ANALYZING`
5. `GENERATING_REPORT`
6. `COMPLETED`
7. `FAILED`

Transition owner: `PipelineEngine.execute`

- On any thrown error, state is updated to `FAILED` and error message is persisted.

## 6. Pipeline Engine Behavior

Source: `nodeBackend/src/workflow/pipelineEngine.js`

### 6.1 Preconditions

1. Load report by ID (includes joined company data).
2. Validate `report.sector` exists; if missing, throw `400` application error.

### 6.2 Service call sequence

Hard-required steps:

1. `document_parser` -> `POST /parse-document`
   - Must return `status = parsed`.
2. `report_generator` -> `POST /generate-report`
   - Must return `status = completed`.

Participation steps (strict vs best-effort policy):

1. `structure_detector` -> `POST /detect-structure`
2. Extractors (run concurrently):
   - `financial_statement_extractor` -> `POST /extract-financials`
   - `balance_sheet_extractor` -> `POST /extract-financials`
   - `cashflow_extractor` -> `POST /extract-financials`
   - `segment_extractor` -> `POST /extract-financials`
   - `governance_extractor` -> `POST /extract-governance`
   - `risk_extractor` -> `POST /extract-risk`
   - `esg_extractor` -> `POST /extract-esg`
3. Analytics (run concurrently):
   - `ratio_calculator` -> `POST /calculate-ratios`
   - `strategy_nlp` -> `POST /extract-strategy`
   - `kpi_sector_engine` -> `POST /sector-kpis` (payload uses `sector`, not `file_path`)
   - `pattern_detection` -> `POST /detect-patterns`

### 6.3 Strict mode switch

Configured by `PIPELINE_STRICT_ALL_BACKENDS`:

1. `false` (default resilient mode)
   - Participation calls are best-effort.
   - Failures are logged and converted to `{ status: "failed", bestEffort: true }`.
   - Pipeline continues unless required steps fail.
2. `true` (strict mode)
   - Participation calls become fail-fast required.
   - Any participation failure causes full pipeline failure.

Batch-specific override:

- Batch execution explicitly sets `strictAllBackends: false` for per-file pipelines.

## 7. Service Discovery, Timeouts, Retry

Sources:

- `nodeBackend/src/config/serviceRegistry.js`
- `nodeBackend/src/clients/serviceClient.js`

Default service URLs:

- `document_parser`: `http://localhost:8001`
- `structure_detector`: `http://localhost:8002`
- `financial_statement_extractor`: `http://localhost:8003`
- `balance_sheet_extractor`: `http://localhost:8004`
- `cashflow_extractor`: `http://localhost:8005`
- `ratio_calculator`: `http://localhost:8006`
- `segment_extractor`: `http://localhost:8007`
- `governance_extractor`: `http://localhost:8008`
- `risk_extractor`: `http://localhost:8009`
- `esg_extractor`: `http://localhost:8010`
- `strategy_nlp`: `http://localhost:8011`
- `kpi_sector_engine`: `http://localhost:8012`
- `pattern_detection`: `http://localhost:8013`
- `report_generator`: `http://localhost:8014`
- `comparative_analysis`: `http://localhost:8015`

Timeouts:

1. Pipeline required calls: `300000 ms`
2. Pipeline best-effort calls: `300000 ms`
3. ServiceClient default timeout (when caller does not override): `120000 ms`

Retries (per HTTP request):

1. Max attempts: `3`
2. Retriable network codes: `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`
3. Delay between retries: `1500 ms`

## 8. Persistence and Data Layout

### 8.1 Postgres

Company upsert:

- Keyed by `symbol` conflict.
- Updates `name`, `sector`, `updated_at` on conflict.

Report row:

- Created with `workflow_state = UPLOADED`.
- State and `error_message` are updated during pipeline progression/failure.

### 8.2 Redis keys

Common report-level keys (written by Python services):

- `report:{report_id}`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:final_report`

Batch comparative key:

- `report:batch:{batch_id}:comparative`

Batch TTL:

- Comparative result is stored with expiry `redis_ttl_seconds` (default `3600`).

## 9. Comparative Analysis Result Shape

Sources:

- `comparative_analysis/api/routes.py`
- `comparative_analysis/services/comparative_service.py`
- `comparative_analysis/models/schemas.py`

Comparative process summary:

1. Deduplicate `report_ids`.
2. Build report snapshots/readiness.
3. Build anchor year per report.
4. Aggregate year metrics, ratio history, and pattern history.
5. Compute:
   - `verified_financial_summary`
   - `metric_trends`
   - `growth_analysis`
   - `dupont_analysis`
   - `cashflow_breakdown`
   - `ratio_comparison`
   - `risk_heatmap`
   - `risk_stability_indicators`
   - `data_integrity`
   - `analyst_commentary`
6. Run quality gate and set `status = completed|failed`.
7. Store full result in Redis under batch key with TTL.

Important fields in stored batch payload:

- `batch_id`, `company`, `status`
- `report_ids`, `requested_report_ids`, `skipped_report_ids`, `report_readiness`
- `years_analyzed`, `report_anchor_years`
- `quality_gate`, `data_integrity`
- All major analytics sections listed above

## 10. Runtime Configuration (Node)

Source: `nodeBackend/src/config/env.js`

- `PORT` (default `3000`)
- `NODE_ENV` (default `development`)
- `DATABASE_URL`
- `UPLOAD_DIR` (default `./uploads`)
- `PIPELINE_STRICT_ALL_BACKENDS` (default `false`)
- `BATCH_PIPELINE_CONCURRENCY` (default `3`, min effective value `1`)

## 11. Local Startup / Shutdown Scripts

Sources:

- `start_all_backends_local.ps1`
- `stop_all_backends_local.ps1`

`start_all_backends_local.ps1` behavior:

1. Resolve DB port (auto-detect postgres listener if default not reachable and port not explicitly set).
2. Build local DB URLs for Python and Node.
3. Enforce DB reachability (hard fail if unavailable).
4. Enforce Redis reachability and protocol health (hard fail if unavailable/invalid/fake redis process detected).
5. Start Node orchestrator on `:3000` (optional skip via `-SkipNode`).
6. Start Python backends on `:8001..:8015`.
7. Wait up to 30s per port for readiness.
8. Persist started process metadata to `backend_pids.json`.

`stop_all_backends_local.ps1` behavior:

1. Stop processes from `backend_pids.json`.
2. Fallback cleanup: kill listeners on known backend ports.
3. Delete `backend_pids.json`.
4. Report whether any backend ports remain open.

## 12. Docker Startup Reality Check

Sources:

- `start_all_backends.ps1`
- `docker-compose.yml`

Current behavior:

1. `start_all_backends.ps1` runs `docker compose up` (optional `--build`, `-d`).
2. `docker-compose.yml` includes Postgres, Redis, Node orchestrator, and Python services up to `report_generator` (`:8014`).
3. `comparative_analysis` is not currently defined in `docker-compose.yml`.

Operational implication:

- Batch comparative flow (`/reports/batch` and `/reports/batch/:batchId`) requires `comparative_analysis` running separately or added to compose.

## 13. End-to-End Characteristics

1. Single report API is synchronous and returns only after pipeline completion/failure.
2. Batch report processing is concurrent per file (bounded worker model).
3. Batch mode intentionally favors resiliency (`strictAllBackends: false`) for per-file pipelines.
4. Consolidated multi-year PDF is generated once per batch (not one PDF per file).
5. Comparative batch payload is Redis-backed and TTL-bound; not durable without extra persistence.
