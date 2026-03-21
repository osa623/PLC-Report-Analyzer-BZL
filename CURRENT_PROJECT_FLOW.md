# Current Project Flow (As Implemented)

This document describes the *actual current runtime flow* of the PLC Report Analyzer stack based on the code in the repository.

## 1. Entry Point

Client uploads report to Node orchestrator:

- `POST /reports` (multipart form)
- Fields:
  - `report` (PDF file)
  - `symbol`
  - `name`
  - `sector`

Node endpoint:
- `nodeBackend/src/routes/reportRoutes.js`
- `nodeBackend/src/controllers/reportController.js`
- `nodeBackend/src/services/reportService.js`

## 2. Upload + Metadata Persistence (Node)

`ReportService.uploadAndAnalyze` does:

1. Creates upload folder (if missing)
2. Saves PDF to absolute path under `nodeBackend/uploads`
3. Upserts company in Postgres (`companies` table)
4. Inserts report row in Postgres (`reports` table) with `workflow_state = UPLOADED`
5. Calls pipeline engine synchronously

Important:
- PDF path is now absolute (`path.resolve(...)`) to avoid cross-service file path issues.

## 3. Workflow States (Postgres)

The report transitions through:

1. `UPLOADED`
2. `PARSING`
3. `EXTRACTING`
4. `ANALYZING`
5. `GENERATING_REPORT`
6. `COMPLETED`
7. `FAILED` (on required-step failure)

State enum source:
- `nodeBackend/src/workflow/states.js`

## 4. Service Registry (Ports)

Node calls services via:
- `nodeBackend/src/config/serviceRegistry.js`

Default local endpoints:

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

## 5. Orchestration Logic (Required vs Optional)

Pipeline source:
- `nodeBackend/src/workflow/pipelineEngine.js`

### 5.1 Required steps

If these fail, workflow becomes `FAILED`:

1. `document_parser /parse-document`
   - Must return `status = parsed`
2. `report_generator /generate-report`
   - Must return `status = completed`

### 5.2 Optional steps

These are invoked with tolerant behavior (`Promise.allSettled` + warning logs):

- `structure_detector`
- financial extractors (`income`, `balance`, `cashflow`, `segment`)
- `governance_extractor`
- `risk_extractor`
- `esg_extractor`
- `ratio_calculator`
- `strategy_nlp`
- `kpi_sector_engine`
- `pattern_detection`

If optional services fail/timeout, pipeline can continue and still produce a report if required stages succeed.

## 6. Timeout and Retry Behavior

Service client source:
- `nodeBackend/src/clients/serviceClient.js`

Current behavior:

- Required timeout: `300000 ms`
- Optional timeout: `300000 ms`
- Retry attempts per service call: `3`
- Retries for transient transport errors (`ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`)

## 7. Redis Data Model (Runtime Artifacts)

Most Python services write/read Redis keys with prefix `report`.

Common keys:

- `report:{report_id}` (base payload)
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:final_report`
- optional domain keys (`:risk`, `:strategy`, etc.)

### 7.1 Final generated output location

`report_generator` writes final JSON to:

- `report:{report_id}:final_report`

This is Redis-backed ephemeral storage (TTL controlled by service config).

## 8. Report Generator Output Shape

`report_generator` builds and stores:

- `report_id`
- `summary`
- `ratios`
- `patterns`
- `segment_analysis`
- `risk_flags`
- `narrative_consistency`

Source:
- `report_generator/services/report_service.py`

## 9. Local Non-Docker Runtime Flow

Launcher:
- `start_all_backends_local.ps1`

What it does:

1. Resolves DB host/port
2. Verifies DB reachability
3. Checks Redis reachability (warning if unavailable)
4. Starts Node orchestrator
5. Starts all Python services on ports `8001..8014`
6. Waits for each service port to become reachable
7. Writes process metadata to `backend_pids.json`

### 9.1 Local Redis in current setup

If native Redis is unavailable on Windows, current fallback script is:

- `scripts/start_fake_redis.py`

It starts a local Redis-compatible TCP server on:
- `127.0.0.1:6379`

## 10. Postgres vs Redis Responsibilities

- Postgres:
  - Company identity (`companies`)
  - Report lifecycle (`reports` + `workflow_state`)
- Redis:
  - Inter-service extraction/analysis payloads
  - Final generated report artifact (`:final_report`)

## 11. API Outputs

`POST /reports` returns:

- `report` (DB report record)
- `generatedReport` (status object from report_generator)

`GET /reports/:reportId` returns:

- report DB metadata and workflow state

## 12. Known Characteristics of Current Flow

1. Pipeline is synchronous from the API caller perspective.
2. Optional services can fail without blocking completion.
3. Final report is currently stored in Redis, not persisted as a file by default.
4. Redis TTL means final output can expire unless copied to durable storage.

## 13. Recommended Next Increment (Optional)

If durable report retention is required, add a persistence sink after report generation:

- Save `report:{id}:final_report` JSON to disk or Postgres (or both)
- Keep Redis for fast pipeline handoff, not long-term storage
