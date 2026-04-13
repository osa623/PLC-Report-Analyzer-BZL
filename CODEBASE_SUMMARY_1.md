# PLC-Report-Analyzer-BZL Current Code Structure

Last updated: 2026-04-06

This file documents the current repository structure in a code-focused way.

Scope notes:
- Includes active code, configs, docs, scripts, and test structure.
- Excludes noisy/system folders from detailed listing: `.git/`, `.venv/`, `node_modules/`, `.tmp_ci_env/`.
- Runtime artifact folders are listed, but large generated file lists are summarized.

## Root Layout

```text
PLC-Report-Analyzer-BZL/
|- .github/
|  |- workflows/
|  |  |- quality-gates.yml
|- aggregation_service/
|- balance_sheet_extractor/
|- cashflow_statement_extractor/
|- common/
|- comparative_analysis/
|- data/
|- data_validator/
|- database/
|- docs/
|- document_parser/
|- equity_extractor/
|- esg_extractor/
|- frontend/
|- governance_extractor/
|- income_notes_extractor/
|- income_statement_extractor/
|- kpi_sector_engine/
|- logs/
|- nodeBackend/
|- oci_extractor/
|- pattern_detection/
|- ratio_calculator/
|- report_generator/
|- risk_extractor/
|- scripts/
|- segment_extractor/
|- strategy_nlp/
|- structure_detector/
|- tests/
|- validation_engine/
|- .gitignore
|- backend_architecture.md
|- CODEBASE_SUMMARY_1.md
|- CODING_GUIDE.md
|- CURRENT_PROJECT_FLOW.md
|- docker-compose.yml
|- README.md
|- ROAD_MAP.md
|- start_all_backends.ps1
|- start_all_backends_local.ps1
|- start_frontend.ps1
|- stop_all_backends_local.ps1
|- SYSTEM_ARCHITECTURE.md
|- tmp_fix_enum.js
|- tmp_full_test_output.txt
```

## Service-Level Structure

### 1) `aggregation_service/`
```text
aggregation_service/
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 2) `balance_sheet_extractor/`
```text
balance_sheet_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- error_codes.py
|  |- logging_utils.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/extraction_worker.py
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
|- test_manual.py
```

### 3) `cashflow_statement_extractor/`
```text
cashflow_statement_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/extraction_worker.py
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
|- test_manual.py
```

### 4) `common/` (shared utilities)
```text
common/
|- __init__.py
|- prompts.py
|- redis_client.py
|- report_repository.py
```

### 5) `comparative_analysis/`
```text
comparative_analysis/
|- api/routes.py
|- core/
|  |- config.py
|  |- dependencies.py
|  |- redis_client.py
|- models/schemas.py
|- services/comparative_service.py
|- .env
|- .gitignore
|- main.py
|- requirements.txt
|- .mypy_cache/ (tool cache)
```

### 6) `data/`
```text
data/
|- eval/
|  |- cases/
|  |- golden_set_metadata.json
|  |- last_benchmark_report.json
|  |- last_beta_readiness_report.json
|  |- last_release_readiness_report.json
|  |- ops_snapshot.json
|  |- release_readiness_snapshot.json
|  |- thresholds.json
|- Banking_HNB_2022.pdf
|- Banking_HNB_2023.pdf
|- Banking_HNB_2024.pdf
```

### 7) `data_validator/`
```text
data_validator/
|- api/routes.py
|- core/core/
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- statement_adapter.py
|  |- transformation_service.py
|  |- validation_service.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 8) `database/`
```text
database/
|- .gitignore
|- schema.sql
```

### 9) `docs/`
```text
docs/
|- frontend_connection_roadmaps/
|  |- 00_INDEX.md
|  |- 01_node_orchestrator.md
|  |- 02_document_parser.md
|  |- 03_structure_detector.md
|  |- 04_income_statement_extractor.md
|  |- 05_balance_sheet_extractor.md
|  |- 06_cashflow_statement_extractor.md
|  |- 07_income_notes_extractor.md
|  |- 08_segment_extractor.md
|  |- 09_governance_extractor.md
|  |- 10_risk_extractor.md
|  |- 11_esg_extractor.md
|  |- 12_strategy_nlp.md
|  |- 13_ratio_calculator.md
|  |- 14_kpi_sector_engine.md
|  |- 15_pattern_detection.md
|  |- 16_report_generator.md
|  |- 17_oci_extractor.md
|  |- 18_equity_extractor.md
|  |- 19_data_validator.md
|  |- 20_comparative_analysis.md
|  |- 21_aggregation_service.md
|  |- 22_validation_engine.md
|- BETA_TUNING_PLAN.md
|- DATA_RETENTION_PRIVACY.md
|- ERROR_CODES.md
|- LAUNCH_CHECKLIST.md
|- OBSERVABILITY_DASHBOARDS.md
|- OPERATIONS_BASELINE.md
|- RELEASE_NOTES_TEMPLATE.md
|- ROLLBACK_PLAYBOOK.md
|- RUNBOOK.md
```

### 10) `document_parser/`
```text
document_parser/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|  |- redis_client.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- chunking_service.py
|  |- gemini_client.py
|  |- parsing_service.py
|  |- processor.py
|- workers/worker.py
|- .env.example
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 11) `equity_extractor/`
```text
equity_extractor/
|- api/routes.py
|- core/core/
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- statement_adapter.py
|  |- transformation_service.py
|  |- validation_service.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 12) `esg_extractor/`
```text
esg_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 13) `frontend/`
```text
frontend/
|- public/
|- src/
|  |- components/
|  |- api.js
|  |- App.jsx
|  |- DashboardApp.jsx
|  |- index.css
|  |- main.jsx
|  |- PipelineApp.jsx
|- dist/ (build output)
|- .gitignore
|- index.html
|- package.json
|- package-lock.json
|- postcss.config.js
|- tailwind.config.js
|- vite.config.js
```

### 14) `governance_extractor/`
```text
governance_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 15) `income_notes_extractor/`
```text
income_notes_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/extraction_worker.py
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 16) `income_statement_extractor/`
```text
income_statement_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- statement_adapter.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 17) `kpi_sector_engine/`
```text
kpi_sector_engine/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|  |- redis_client.py
|- data/sector_benchmarks.json
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- gemini_client.py
|  |- kpi_factory.py
|  |- kpi_service.py
|  |- kpi_strategies.py
|  |- processor.py
|- workers/worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 18) `logs/`
```text
logs/
|- service stdout/stderr log files for local/backend runs
|- examples: *.log, *.err.log per microservice
```

### 19) `nodeBackend/`
```text
nodeBackend/
|- src/
|  |- clients/
|  |- config/
|  |- controllers/
|  |- middleware/
|  |- repositories/
|  |- routes/
|  |- services/
|  |- utils/
|  |- workflow/
|  |- app.js
|  |- server.js
|- uploads/ (runtime PDF uploads, large volatile file set)
|- .env
|- .env.example
|- .gitignore
|- Dockerfile
|- package.json
|- package-lock.json
|- README.md
```

### 20) `oci_extractor/`
```text
oci_extractor/
|- api/routes.py
|- core/core/
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- statement_adapter.py
|  |- transformation_service.py
|  |- validation_service.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 21) `pattern_detection/`
```text
pattern_detection/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|  |- redis_client.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- gemini_client.py
|  |- pattern_service.py
|  |- processor.py
|- workers/worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 22) `ratio_calculator/`
```text
ratio_calculator/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|  |- redis_client.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- gemini_client.py
|  |- processor.py
|  |- ratio_service.py
|- workers/worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 23) `report_generator/`
```text
report_generator/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|  |- redis_client.py
|- generated_reports/ (generated PDFs + implementation notes)
|- models/schemas.py
|- output_test/
|  |- comparative_test.pdf
|- repositories/report_repository.py
|- services/
|  |- gemini_client.py
|  |- pdf_builder.py
|  |- processor.py
|  |- report_service.py
|- workers/worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
|- test_pdf.py
```

### 24) `risk_extractor/`
```text
risk_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 25) `scripts/`
```text
scripts/
|- run_beta_readiness.py
|- run_golden_benchmark.py
|- run_release_readiness.py
|- smoke_test_batch_flow.ps1
|- start_fake_redis.py
```

### 26) `segment_extractor/`
```text
segment_extractor/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- confidence_service.py
|  |- extraction_service.py
|  |- fallback_adapter.py
|  |- gemini_client.py
|  |- guardrails_service.py
|  |- job_service.py
|  |- observability_service.py
|  |- processor.py
|  |- routing_policy.py
|  |- transformation_service.py
|  |- validation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .gitignore
|- Dockerfile
|- FLOW.md
|- main.py
|- requirements.txt
```

### 27) `strategy_nlp/`
```text
strategy_nlp/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- extraction_service.py
|  |- gemini_client.py
|  |- processor.py
|  |- transformation_service.py
|- workers/
|  |- extraction_worker.py
|  |- worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 28) `structure_detector/`
```text
structure_detector/
|- api/routes.py
|- common/
|  |- __init__.py
|  |- redis_client.py
|  |- report_repository.py
|- core/
|  |- config.py
|  |- database.py
|  |- dependencies.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/
|  |- gemini_client.py
|  |- processor.py
|- workers/worker.py
|- .env
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

### 29) `tests/`
```text
tests/
|- README.md
|- __init__.py
|- step_01/
|- step_02/
|- step_03/
|- step_04/
|- step_05/
|- step_06/
|- step_07/
|- step_08/
|- step_09/
|- step_10/
|- step_11/
|- step_12/
|- step_13/
|- step_14/
```

Each step folder includes step-specific test modules, usually:
- `__init__.py`
- `test_*` functional and rollout-contract checks for that roadmap step.

### 30) `validation_engine/`
```text
validation_engine/
|- .gitignore
|- Dockerfile
|- main.py
|- requirements.txt
```

## Common Microservice Blueprint (Observed Pattern)

Most Python services follow this skeleton:

```text
<service>/
|- api/routes.py
|- core/config.py
|- models/schemas.py
|- repositories/report_repository.py
|- services/*.py
|- workers/*.py (optional)
|- main.py
|- requirements.txt
|- Dockerfile
```

## Notes for Maintenance

- Runtime-heavy folders (`nodeBackend/uploads/`, `logs/`, `frontend/dist/`) should generally be excluded from long-term architecture reviews.
- If you want an automatically refreshed structure file in CI, this file can be generated from a small PowerShell script and committed as part of release checks.