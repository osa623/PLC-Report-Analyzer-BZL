# Data-First Project Structure (Completed Blueprint)

This is the completed target structure for the architecture defined in CURRENT_PROJECT_FLOW.md.
It reflects the existing 3-service consolidation while preserving explicit stage boundaries (aggregation, validation, canonical dataset, analytics gating).

## 1. Canonical Runtime Flow

PDF Upload
-> document_parser
-> structure_detector
-> extractors (parallel)
-> aggregation_service
-> validation_engine
-> canonical_validated dataset
-> analytics layer
-> frontend inspection system
-> report_generator

## 2. Completed Folder Structure

```text
PLC-Report-Analyzer-BZL/
  nodeBackend/
    src/
      controllers/
      services/
      repositories/
      routes/
      middleware/
      config/
      orchestration/

  ingestion_extraction_platform/
    main.py
    requirements.txt
    Dockerfile
    modules/
      pipeline/
        service.py
      parsing/
        service.py
      structure/
        service.py
      worker_pool/
        service.py
      schema_validation/
        service.py
      financial_extractors/
        service.py
      narrative_extractors/
        service.py

  data_quality_intelligence_engine/
    main.py
    requirements.txt
    Dockerfile
    modules/
      aggregation/
        service.py
      validation/
        service.py
      confidence_scoring/
        service.py
      gating/
        service.py
      analytics/
        service.py
      batch_comparative/
        service.py

  reporting_delivery_service/
    main.py
    requirements.txt
    Dockerfile
    modules/
      report_generation/
        service.py
      workflow_tracking/
        service.py
      inspection_api/
        service.py
      notifications/
        service.py
      observability/
        service.py

  platform_core/
    __init__.py
    service_base/
    llm_gateway/
    data_access/
    job_framework/
    observability/
    validation_framework/
    contracts/
      __init__.py
      canonical_dataset.py
      pipeline_stage.py
      redis_keys.py

  balance_sheet_extractor/
  cashflow_statement_extractor/
  income_statement_extractor/
  income_notes_extractor/
  segment_extractor/
  governance_extractor/
  risk_extractor/
  esg_extractor/

  frontend/
    src/
      components/
      hooks/
      services/
      pages/

  database/
    schema.sql

  data/
    eval/

  docs/
    architecture/
      DATA_FIRST_PROJECT_STRUCTURE.md
      DATA_FIRST_DEEP_SUMMARY.md

  tests/
    step_01/
    ...
    step_14/
```

## 3. Logical-to-Physical Mapping

1. aggregation_service (logical) -> data_quality_intelligence_engine/modules/aggregation/
2. validation_engine (logical) -> data_quality_intelligence_engine/modules/validation/
3. canonical_dataset contract -> platform_core/contracts/canonical_dataset.py + Redis key report:{report_id}:canonical_validated
4. analytics layer -> data_quality_intelligence_engine/modules/analytics/
5. workflow transparency -> reporting_delivery_service/modules/inspection_api/ + frontend data views

## 4. Required Data Artifacts

1. report:{report_id}:document_chunks
2. report:{report_id}:structure
3. report:{report_id}
4. report:{report_id}:canonical_raw
5. report:{report_id}:canonical_validated
6. report:{report_id}:ratios
7. report:{report_id}:sector_kpis
8. report:{report_id}:patterns
9. report:{report_id}:final_report

## 5. Governance Rules for this Structure

1. No analytics service can consume report:{report_id} directly.
2. Analytics may only consume report:{report_id}:canonical_validated.
3. validation_engine must run before any ratio/pattern/KPI computation.
4. report_generator must include quality score and confidence context.
5. Batch comparative must reject low-confidence reports and persist exclusion reasons.
