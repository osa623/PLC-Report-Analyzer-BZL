# PLC Report Analyzer BZL

An end-to-end, multi-service platform for analyzing annual reports (PDF) and producing structured financial intelligence, sector comparisons, risk narratives, and generated report outputs.

This repository combines:
- A Node.js orchestration backend for API entry, workflow control, and state transitions
- Python microservices for extraction, enrichment, analytics, and report generation
- Redis for fast, ephemeral analytical artifacts
- Postgres for orchestrator metadata and report registry records
- Step-based quality gates from baseline hardening through launch readiness

## What the Platform Does

At runtime, the platform processes uploaded annual reports and produces:
- Parsed document artifacts and structural metadata
- Statement and note extraction outputs
- Domain extracts (governance, risk, ESG, strategy)
- Derived analytics (ratios, KPI benchmarking, pattern detection)
- Final generated report payloads
- Batch comparative analysis across multiple reports

## Current Status

Roadmap execution has been implemented through Step 14, including:
- Step 12: golden dataset benchmark suite + regression gate
- Step 13: beta readiness gate + rollout/tuning artifacts
- Step 14: public launch readiness gate + rollback/privacy deliverables

Automated test suites are organized under tests/step_XX and validated via unittest discovery.

## Architecture Overview

Data-first canonical references:
- `CURRENT_PROJECT_FLOW.md`
- `docs/architecture/DATA_FIRST_PROJECT_STRUCTURE.md`
- `docs/architecture/DATA_FIRST_DEEP_SUMMARY.md`

### High-level layers
1. Ingestion and structure detection
2. Domain extraction and normalization
3. Derived metrics and analytics
4. Pattern intelligence and report generation
5. Batch comparative analysis and launch-quality gates

### Runtime planes
- Node plane: orchestrates workflows, exposes public API routes, manages report and batch flow
- Python plane: performs extraction and analytics per service boundary

## Service Inventory

| Service | Port | Role | Primary Endpoint |
|---|---:|---|---|
| nodeBackend (orchestrator) | 3000 | Public API, workflow engine | POST /reports, POST /reports/batch |
| document_parser | 8001 | PDF parse baseline | POST /parse-document |
| structure_detector | 8002 | Section/layout detection | POST /detect-structure |
| income_statement_extractor | 8003 | Statement extraction | POST /extract-financials |
| balance_sheet_extractor | 8004 | Balance sheet extraction | POST /extract-financials |
| cashflow_statement_extractor | 8005 | Cashflow extraction | POST /extract-financials |
| ratio_calculator | 8006 | Ratio analytics | POST /calculate-ratios |
| segment_extractor | 8007 | Segment extraction | POST /extract-financials |
| governance_extractor | 8008 | Governance extraction | POST /extract-governance |
| risk_extractor | 8009 | Risk extraction | POST /extract-risk |
| esg_extractor | 8010 | ESG extraction | POST /extract-esg |
| strategy_nlp | 8011 | Strategy narrative extraction | POST /extract-strategy |
| kpi_sector_engine | 8012 | Sector KPI comparison | POST /sector-kpis |
| pattern_detection | 8013 | Pattern intelligence | POST /detect-patterns |
| report_generator | 8014 | Consolidated report output | POST /generate-report |
| comparative_analysis | 8015 | Batch comparative output | POST /analyze-comparative |

## End-to-End Workflow

### Single report flow
1. Client uploads one PDF via Node API.
2. Orchestrator stores upload and report metadata.
3. Pipeline transitions through states (PARSING, EXTRACTING, ANALYZING, GENERATING_REPORT).
4. Python services perform extraction and analysis.
5. Final report payload is returned and stored in Redis final-report key.

### Batch comparative flow
1. Client uploads up to 10 PDFs.
2. Orchestrator runs per-file pipeline.
3. Successful report IDs are aggregated.
4. Comparative service computes cross-report insights.
5. Batch result is retrievable by batch ID.

### Pipeline state model
- UPLOADED
- PARSING
- EXTRACTING
- ANALYZING
- GENERATING_REPORT
- COMPLETED
- FAILED

## Data Contracts

### Standard service request envelope
Most services consume a minimal envelope:

```json
{
  "report_id": "<uuid>",
  "file_path": "<absolute-path-to-pdf>"
}
```

Some analytical services accept specialized fields (for example sector or batch payload metadata).

## Storage Model

### Postgres
Used by orchestrator for company/report metadata and workflow-level tracking.

### Redis key model
Primary key namespace:
- report:{report_id}

Derived artifacts:
- report:{report_id}:ratios
- report:{report_id}:sector_kpis
- report:{report_id}:patterns
- report:{report_id}:final_report
- report:{report_id}:governance
- report:{report_id}:risk
- report:{report_id}:esg
- report:{report_id}:strategy
- report:batch:{batch_id}:comparative

Many keys are TTL-backed for ephemeral runtime behavior.

## Quality and Release Gates

### Step 12 benchmark gate
- Script: scripts/run_golden_benchmark.py
- Outputs benchmark report + threshold pass/fail

### Step 13 beta gate
- Script: scripts/run_beta_readiness.py
- Evaluates benchmark quality + operational signals (latency/failure/queue depth)

### Step 14 launch gate
- Script: scripts/run_release_readiness.py
- Validates launch criteria including rollback/privacy readiness

### CI workflow
The .github/workflows/quality-gates.yml pipeline runs:
1. Unit tests
2. Golden benchmark gate
3. Beta readiness gate
4. Public launch readiness gate

## Step-Based Test Strategy

Test suites are grouped by roadmap step under tests/step_XX.

Run all tests:

```powershell
python -m unittest discover -s tests -p "test_*.py"
```

Run benchmark gate:

```powershell
python scripts/run_golden_benchmark.py --metadata data/eval/golden_set_metadata.json --thresholds data/eval/thresholds.json --output data/eval/last_benchmark_report.json --fail-on-regression
```

Run beta gate:

```powershell
python scripts/run_beta_readiness.py --benchmark-report data/eval/last_benchmark_report.json --ops-snapshot data/eval/ops_snapshot.json --output data/eval/last_beta_readiness_report.json --fail-on-blocker
```

Run launch gate:

```powershell
python scripts/run_release_readiness.py --benchmark-report data/eval/last_benchmark_report.json --beta-report data/eval/last_beta_readiness_report.json --readiness-snapshot data/eval/release_readiness_snapshot.json --output data/eval/last_release_readiness_report.json --fail-on-blocker
```

## Local Setup

### Option A: Docker compose

```powershell
docker compose up --build
```

This starts Postgres, Redis, Node orchestrator, and configured Python services.

### Option B: Local processes

```powershell
./start_all_backends_local.ps1
```

Stop local stack:

```powershell
./stop_all_backends_local.ps1
```

### Environment variables

Create a local `.env` file at the repository root by copying `.env.sample` and filling in secret values. Do NOT commit `.env`.

```bash
cp .env.sample .env
# edit .env and insert keys
```

We load `.env` automatically at service startup when `python-dotenv` is installed. To install it for the extraction service:

```bash
cd services/extraction_service
python -m pip install -r requirements.txt
```

Key variables are listed in `.env.sample` (Document AI, AWS, Gemini, REDIS_URL, DATABASE_DSN, METRICS_PORT, PIPELINE_TMP).

**End-to-end local setup (recommended for real E2E testing)**

- Start local infra (Redis + Postgres) and install deps (requires Docker):

```powershell
# Windows PowerShell
.\scripts\setup_full_env.ps1 -InstallDeps -StartInfra
```

```bash
# POSIX
./scripts/setup_full_env.sh install-deps start-infra
```

- After starting infra, edit `.env` and populate real credentials (Document AI processor, Google service account or API key, AWS keys, Gemini/OpenAI keys). Do NOT commit `.env`.

- Run the pipeline on a PDF (example):

```bash
# from repo root (use .venv if created)
python -m services.extraction_service.orchestrator path/to/input.pdf path/to/output.json
```

If you prefer an offline development run (no cloud SDKs), use:

```bash
python scripts/run_golden_benchmark_local.py
```



## API Entry Points (Node Orchestrator)

- POST /reports
- POST /reports/batch
- GET /reports/:reportId
- GET /reports/batch/:batchId

Input form-data fields typically include:
- report or reports (PDF files)
- symbol
- name
- sector

## Tech Stack

### Backend and services
- Node.js + Express (orchestrator)
- Python + FastAPI (microservices)
- Pydantic settings/modeling

### Data and messaging
- PostgreSQL
- Redis

### AI and extraction
- Gemini-powered extraction clients and transformation services across extractor modules

### DevOps and quality
- Docker + Docker Compose
- GitHub Actions workflow gates
- unittest-based step suites

## A-Z Workflow and Backend Function Map

- A: API intake via Node report routes
- B: Batch upload orchestration for multi-report runs
- C: Company/report metadata persistence in Postgres
- D: Document parsing service baseline extraction
- E: ESG extraction and normalization
- F: Financial statement extraction pipeline
- G: Governance domain extraction
- H: Health and status retrieval endpoints
- I: Income notes and statement value extraction
- J: Job state transitions in workflow engine
- K: KPI sector benchmarking against reference data
- L: Launch-readiness gate evaluation (Step 14)
- M: Model-driven extraction and confidence-aware outputs
- N: Narrative strategy extraction (NLP)
- O: Operational readiness checks and runbooks
- P: Pattern detection across ratios, risk, and strategy signals
- Q: Quality gates (benchmark, beta, launch)
- R: Ratio calculation and derived metrics
- S: Structure detection and section mapping
- T: Threshold enforcement for regression protection
- U: Upload handling for single and batch flows
- V: Validation and standardized schema outputs
- W: Workflow orchestration with resilient or strict mode behavior
- X: Cross-report comparative analytics for batch insights
- Y: Year-over-year and trend analytics in downstream services
- Z: Zero-blocker launch target through release readiness checks

## Operational and Launch Docs

- docs/RUNBOOK.md
- docs/OBSERVABILITY_DASHBOARDS.md
- docs/BETA_TUNING_PLAN.md
- docs/LAUNCH_CHECKLIST.md
- docs/ROLLBACK_PLAYBOOK.md
- docs/DATA_RETENTION_PRIVACY.md
- docs/RELEASE_NOTES_TEMPLATE.md

## Known Integration Notes

This repository includes historical and active evolution paths. Before production launch, verify:
- Endpoint naming alignment between orchestrator clients and Python service routes
- Compose and local launcher mapping consistency against current folder/service names
- Port and key namespace consistency where multiple extractors converge

## Repository Layout (Top Level)

- nodeBackend: public API orchestrator
- document_parser, structure_detector: ingestion and structure services
- statement extractors: income_statement_extractor, balance_sheet_extractor, cashflow_statement_extractor, income_notes_extractor
- domain extractors: segment_extractor, governance_extractor, risk_extractor, esg_extractor, strategy_nlp
- analytics: ratio_calculator, kpi_sector_engine, pattern_detection, comparative_analysis
- output: report_generator
- scripts: quality gates and helper scripts
- tests: step-based regression suites
- docs: runbooks, dashboards, rollout, launch, privacy, rollback

## Contribution Guidance

1. Keep changes scoped to one roadmap step at a time.
2. Add or update step tests under tests/step_XX.
3. Run full test and quality gates before merge.
4. Update docs when contracts, routes, or thresholds change.

## Disclaimer

This platform supports analytical workflows and should be used with domain review for critical financial decisions.
