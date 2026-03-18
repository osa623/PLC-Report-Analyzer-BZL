# PLC-Report-Analyzer-BZL Detailed Codebase Overview

## 1) What This Repository Is
This repository implements a multi-service annual report processing platform with two major execution planes:

- Node.js orchestration plane (`nodeBackend`) for workflow coordination and service-to-service calls.
- Python domain microservices for parsing, extraction, analysis, and report generation.

At a high level the intended flow is:

1. Parse document metadata and detect structure.
2. Extract financial and narrative data from PDF content.
3. Compute ratios and higher-order patterns.
4. Assemble final report payload.

The current implementation is mixed-mode:

- Most extraction/analysis services now persist to Redis (ephemeral, TTL-based).
- Some ingestion components (`document_parser`, `structure_detector`) still use SQL repositories.

## 2) Repository Topology

### Root-level orchestration and docs
- `docker-compose.yml`: container composition, network, Postgres, Node orchestrator, Python services.
- `start_all_backends.ps1` / `start_all_backends_local.ps1`: local process launcher scripts.
- `backend_architecture.md` and `SYSTEM_ARCHITECTURE.md`: architecture references.

### Service families
- Ingestion: `document_parser`, `structure_detector`
- Financial extraction: `income_statement_extractor`, `balance_sheet_extractor`, `cashflow_statement_extractor`, `income_notes_extractor`, `segment_extractor`
- Narrative extraction: `governance_extractor`, `risk_extractor`, `esg_extractor`, `strategy_nlp`
- Analytics/intelligence: `ratio_calculator`, `kpi_sector_engine`, `pattern_detection`, `report_generator`

### Common Python service skeleton
Most Python services follow this shape:

- `api/routes.py`: external endpoint contract
- `models/schemas.py`: request/response contracts
- `core/config.py`: runtime settings
- `core/dependencies.py`: dependency wiring
- `services/*.py`: business logic
- `repositories/report_repository.py`: persistence abstraction
- `main.py`: app bootstrap + health route

## 3) Runtime Architecture

### Docker composition
Current `docker-compose.yml` provides:

- Postgres (`postgres:16-alpine`) on `5432`
- Node orchestrator on `3000`
- Python services on `8001` through `8014`

The common service anchor (`x-common-python-service`) makes Python services depend on Postgres health, even for Redis-centric services.

### Important drift in compose names
Compose currently references service folders that do not exist in this workspace:

- `financial_statement_extractor` (compose) vs existing `income_statement_extractor`
- `cashflow_extractor` (compose) vs existing `cashflow_statement_extractor`

This means compose, local scripts, and active Python service folders are not fully aligned.

## 4) API Surface and Contracts

### Ingestion layer
- `document_parser`: `POST /parse-document`
- `structure_detector`: `POST /detect-structure`

Request model (both):
- `report_id: str`
- `file_path: str`

### Extraction layer
- `income_statement_extractor`: `POST /extract-financials`
- `balance_sheet_extractor`: `POST /extract-financials`
- `cashflow_statement_extractor`: `POST /extract-financials`
- `income_notes_extractor`: `POST /extract-financials`
- `segment_extractor`: `POST /extract-financials`
- `governance_extractor`: `POST /extract-governance`
- `risk_extractor`: `POST /extract-risk`
- `esg_extractor`: `POST /extract-esg`
- `strategy_nlp`: `POST /extract-strategy`

Request model pattern:
- Most extractors: `report_id` + `file_path`

### Analytics and report layer
- `ratio_calculator`: `POST /calculate-ratios`
- `kpi_sector_engine`: `POST /sector-kpis`
- `pattern_detection`: `POST /detect-patterns`
- `report_generator`: `POST /generate-report`

Request model pattern:
- `ratio_calculator`, `pattern_detection`, `report_generator`: `report_id`
- `kpi_sector_engine`: `report_id` + `sector`

## 5) Storage Model and Redis Key Contracts

### Redis baseline settings (majority of modernized services)
- `redis_url`: typically `redis://redis:6379/0`
- `redis_key_prefix`: `report`
- TTL: `redis_ttl_seconds = 900`

### Effective key map

Base source key:
- `report:{report_id}`

Derived keys:
- `report:{report_id}:ratios`
- `report:{report_id}:sector_kpis`
- `report:{report_id}:patterns`
- `report:{report_id}:final_report`
- `report:{report_id}:governance`
- `report:{report_id}:risk`
- `report:{report_id}:esg`
- `report:{report_id}:strategy`

### Writer behavior by service

Writes to base key `report:{report_id}`:
- `income_statement_extractor`
- `balance_sheet_extractor`
- `cashflow_statement_extractor`
- `income_notes_extractor`
- `segment_extractor`

Writes to suffixed key:
- `governance_extractor` -> `:governance`
- `risk_extractor` -> `:risk`
- `esg_extractor` -> `:esg`
- `strategy_nlp` -> `:strategy`
- `ratio_calculator` -> `:ratios`
- `kpi_sector_engine` -> `:sector_kpis`
- `pattern_detection` -> `:patterns`
- `report_generator` -> `:final_report`

## 6) Core Business Logic by Service

### `ratio_calculator`
Primary implementation: `services/ratio_service.py`

- Reads normalized rows from base key.
- Coerces values and groups by `(year, entity_type)`.
- Computes required ratios when numerator/denominator pairs exist:
  - `gross_margin`
  - `net_margin`
  - `current_ratio`
  - `debt_to_equity`
  - `operating_cashflow_ratio`
- Writes result payload to `report:{report_id}:ratios`.

### `kpi_sector_engine`
Primary implementation: `services/kpi_service.py`

- Reads ratios from `report:{report_id}:ratios`.
- Loads static benchmarks from `data/sector_benchmarks.json`.
- Normalizes aliases to canonical KPI names.
- Compares company values with sector averages and classifies each metric as:
  - `above`
  - `inline`
  - `below`
- Writes sector KPI payload to `report:{report_id}:sector_kpis`.

### `pattern_detection`
Primary implementation: `services/pattern_service.py`

- Reads:
  - base data (`report:{report_id}`)
  - ratios (`report:{report_id}:ratios`)
  - optional risk (`report:{report_id}:risk`)
  - optional strategy (`report:{report_id}:strategy`)
- Detects multiple pattern classes:
  - revenue growth/decline
  - margin expansion/compression
  - cost increase and expense spike
  - cost structure shift
  - inefficient growth
  - earnings quality issue
  - liquidity risk
  - segment concentration/imbalance/decline
  - strategy contradiction markers
- Writes pattern output and metadata (including source keys) to `report:{report_id}:patterns`.

### `report_generator`
Primary implementation: `services/report_service.py`

- Reads base, ratios, and patterns payloads.
- Builds consolidated output sections:
  - summary (latest-year financial highlights)
  - ratio buckets (profitability, liquidity, efficiency)
  - confidence-filtered patterns (`confidence > 0.6`)
  - segment analysis
  - risk flags
  - narrative consistency signals
- Writes final artifact to `report:{report_id}:final_report`.

### Extraction services (Gemini + transformation)
Typical flow in `services/extraction_service.py`:

1. Validate PDF path.
2. Extract structured payload via Gemini client.
3. Normalize into canonical rows/records via transformation service.
4. Persist standardized payload to Redis through repository abstraction.

Status model commonly returns one of:
- `completed`
- `partial`
- `failed`

## 7) Ingestion Services Still on SQL Repositories

`document_parser` and `structure_detector` currently:

- Use strategy/factory processors (`services/processor.py`) with Gemini prompts.
- Persist repository payloads via SQLAlchemy session.
- Insert into a table using a query that targets `patterns`.

This is a notable architecture mismatch versus the Redis-first pattern adopted elsewhere.

## 8) Node Orchestrator Workflow (Current Code)

The Node pipeline engine (`nodeBackend/src/workflow/pipelineEngine.js`) runs staged workflow states:

- `PARSING` -> parser + structure detector
- `EXTRACTING` -> extraction service fan-out
- `ANALYZING` -> ratio/strategy/kpi/pattern fan-out
- `GENERATING_REPORT` -> report generation
- `COMPLETED` or `FAILED`

However, the orchestrator currently contains contract drift against Python routes:

- Calls `/extract-balance-sheet` but service exposes `/extract-financials`
- Calls `/extract-cashflow` but service exposes `/extract-financials`
- Calls `/extract-segments` but service exposes `/extract-financials`
- Calls `/extract-risks` but service exposes `/extract-risk`
- Calls `/analyze-strategy` but service exposes `/extract-strategy`
- Calls `/calculate-kpi` but service exposes `/sector-kpis`

This is one of the key integration blockers for a successful end-to-end run.

## 9) Service and Port Snapshot

Configured ports in service configs:

- `document_parser`: 8001
- `structure_detector`: 8002
- `income_statement_extractor`: 8003
- `balance_sheet_extractor`: 8004
- `cashflow_statement_extractor`: 8005
- `ratio_calculator`: 8006
- `segment_extractor`: 8007
- `governance_extractor`: 8008
- `risk_extractor`: 8009
- `esg_extractor`: 8010
- `strategy_nlp`: 8011
- `kpi_sector_engine`: 8012
- `pattern_detection`: 8013
- `report_generator`: 8014

Additional note:
- `income_notes_extractor` currently also declares port 8006 in config, which overlaps with `ratio_calculator`.

## 10) Known Risks and Design Gaps

### A) Base key overwrite risk
Multiple statement extractors write to the same base key `report:{report_id}`.

If they run for the same report concurrently or sequentially without merge semantics, the last write can overwrite prior payloads.

### B) Contract drift between Node and Python services
Route and service-name mismatches in orchestrator and compose/scripts can fail workflow calls.

### C) Mixed persistence strategy
Some services are Redis-first while ingestion still writes through SQL repositories, creating operational inconsistency.

### D) Compose/script naming drift
References to non-existent folders (`financial_statement_extractor`, `cashflow_extractor`) suggest deployment scripts are not fully synchronized with current service directories.

## 11) Practical Reading Order for New Contributors

If you are onboarding quickly, read in this order:

1. `nodeBackend/src/workflow/pipelineEngine.js` to understand intended orchestration.
2. `docker-compose.yml` and `start_all_backends_local.ps1` for runtime topology.
3. `*/api/routes.py` for actual API contracts.
4. `ratio_calculator/services/ratio_service.py`, `pattern_detection/services/pattern_service.py`, `report_generator/services/report_service.py` for core analytics logic.
5. `*/core/config.py` and `*/repositories/report_repository.py` for persistence/key conventions.

## 12) Current Reality in One Line

The platform has a strong modular microservice foundation and substantial Redis-first analytical logic, but it currently needs contract and deployment alignment (service names, endpoints, and storage consistency) to guarantee reliable end-to-end orchestration.
