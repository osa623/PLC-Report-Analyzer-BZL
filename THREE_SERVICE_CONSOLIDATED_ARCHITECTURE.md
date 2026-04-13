# Three-Service Consolidated Architecture (Canonical Data-First Workflow Preserved)

Last updated: 2026-04-13

## 1. Non-Negotiable Invariants

This redesign changes service boundaries only.

The following remain exactly unchanged:

1. Pipeline sequence:
   Upload -> Parsing -> Structure -> Extraction -> Aggregation -> Validation -> Analytics -> Report
2. Redis keyspace names and payload contracts.
3. Validation rules and confidence model.
4. Analytics quality gate behavior.
5. Frontend observability and transparency requirements.
6. Workflow states and transitions.

No pipeline stage, data contract, validation rule, analytics gate, or frontend requirement is removed or weakened.

## 2. Target Runtime Topology (3 Background Services)

### Service 1: Ingestion and Extraction Platform

Purpose:
- Own all ingestion and extraction execution in one process group.
- Replace inter-service HTTP calls with internal module calls.

Internal modules:
- document_parser module
- structure_detector module
- financial extraction modules:
  - income_statement_extractor
  - balance_sheet_extractor
  - cashflow_statement_extractor
  - income_notes_extractor
  - segment_extractor
- narrative extraction modules:
  - governance_extractor
  - risk_extractor
  - esg_extractor
  - strategy_nlp
- bounded parallel worker pool coordinator
- provenance and row-schema enforcement middleware

Outputs (unchanged):
- report:{report_id}:document_chunks
- report:{report_id}:structure
- report:{report_id}
- report:{report_id}:governance
- report:{report_id}:risk
- report:{report_id}:esg
- report:{report_id}:strategy

### Service 2: Data Quality and Intelligence Engine

Purpose:
- Central heavy compute service for canonicalization, validation, analytics, and comparative processing.

Internal modules:
- aggregation_service module
- validation_engine module
- analytics gate module
- ratio_calculator module
- kpi_sector_engine module
- pattern_detection module
- comparative_analysis module

Responsibilities (unchanged):
- Enforce validation as hard gate before analytics.
- Compute row-level confidence_score and validation_flags.
- Compute overall_data_quality_score.
- Block analytics when threshold fails.
- Propagate confidence into metrics and patterns.
- Produce identical Redis outputs.

Outputs (unchanged):
- report:{report_id}:canonical_raw
- report:{report_id}:canonical_validated
- report:{report_id}:ratios
- report:{report_id}:sector_kpis
- report:{report_id}:patterns
- report:batch:{batch_id}:comparative
- report:batch:{batch_id}:eligibility

### Service 3: Reporting and Delivery Service

Purpose:
- Own reporting, pipeline observability APIs, and delivery concerns.

Internal modules:
- report_generator module
- pipeline state tracking module
- frontend inspection data API module
- stage diagnostics and observability exposure module
- notification and webhook module
- report file persistence module

Responsibilities (unchanged):
- Expose pipeline tracker with stage status and timing.
- Expose raw, cleaned, and validated data views.
- Expose confidence and validation diagnostics.
- Expose pattern evidence and traceability.
- Generate report outputs and persist metadata.

Outputs (unchanged):
- report:{report_id}:final_report
- report PDF path persisted in orchestration metadata

## 3. Canonical Pipeline Execution in Consolidated Form

### Single-report flow

1. Service 3 receives upload request and creates workflow record.
2. Service 3 enqueues ingest_extract job to internal queue.
3. Service 1 executes:
   - parse document
   - detect structure
   - run extractors in bounded parallel pools
   - enforce provenance schema
   - write unchanged extraction Redis keys
4. Service 3 enqueues quality_intelligence job.
5. Service 2 executes:
   - aggregate to canonical_raw
   - validate to canonical_validated
   - compute overall_data_quality_score
   - apply analytics gate
   - if pass: run ratios, sector KPIs, patterns
   - if fail: mark LOW_CONFIDENCE path
6. Service 3 executes reporting stage:
   - if gate passed: generate report using validated data and confidence-aware outputs
   - if LOW_CONFIDENCE: preserve terminal state and diagnostics with no analytics/report stage execution
7. Service 3 serves inspection and transparency APIs.

### Batch flow

1. Service 3 creates one job chain per report.
2. Each report runs full single-report canonical flow.
3. Service 2 comparative module runs only on eligible validated reports.
4. Service 3 exposes eligibility summary and comparative outputs.

## 4. Internal Queue and Job Model (Replacing Service-to-Service HTTP)

Queue topics:
- ingest_extract
- quality_intelligence
- generate_report
- comparative_batch

Standard job lifecycle (unchanged semantics):
- QUEUED -> RUNNING -> VALIDATING -> COMPLETED -> FAILED

Job payload minimum:
- report_id or batch_id
- file_path (single report)
- correlation_id
- replay_token
- schema_version

Retry policy:
- deterministic idempotency key per stage
- bounded retries with exponential backoff
- dead-letter stream for unrecoverable errors

## 5. Detailed Module Mapping (From Current Services)

| Current Service | New Home |
|---|---|
| document_parser | Service 1 module |
| structure_detector | Service 1 module |
| income_statement_extractor | Service 1 module |
| balance_sheet_extractor | Service 1 module |
| cashflow_statement_extractor | Service 1 module |
| income_notes_extractor | Service 1 module |
| segment_extractor | Service 1 module |
| governance_extractor | Service 1 module |
| risk_extractor | Service 1 module |
| esg_extractor | Service 1 module |
| strategy_nlp | Service 1 module |
| aggregation_service | Service 2 module |
| validation_engine | Service 2 module |
| ratio_calculator | Service 2 module |
| kpi_sector_engine | Service 2 module |
| pattern_detection | Service 2 module |
| comparative_analysis | Service 2 module |
| report_generator | Service 3 module |
| node_orchestrator thin workflow hops | Replaced by Service 3 internal orchestration + queue |

## 6. Data Contracts and Redis Keyspace (Explicitly Preserved)

Core keys (unchanged):
- report:{report_id}:document_chunks
- report:{report_id}:structure
- report:{report_id}
- report:{report_id}:governance
- report:{report_id}:risk
- report:{report_id}:esg
- report:{report_id}:strategy
- report:{report_id}:canonical_raw
- report:{report_id}:canonical_validated
- report:{report_id}:ratios
- report:{report_id}:sector_kpis
- report:{report_id}:patterns
- report:{report_id}:final_report

Batch keys (unchanged):
- report:batch:{batch_id}:comparative
- report:batch:{batch_id}:eligibility

Required metadata still present where applicable:
- schema_version
- generated_at
- service_version
- source_report_id

## 7. Validation and Quality Gate (Unchanged)

Validation rules preserved:
- balance equation checks
- profitability sanity checks
- cashflow consistency checks
- cross-statement linkage checks
- data cleaning and anomaly flags
- unit and scale normalization

Confidence model preserved:
- row-level confidence_score in [0,1]
- validation_flags per row
- overall_data_quality_score report-level

Analytics gate preserved:
- If overall_data_quality_score < ANALYTICS_QUALITY_THRESHOLD:
  - skip analytics stage
  - skip report generation stage
  - mark workflow LOW_CONFIDENCE

## 8. Frontend Observability Surface (Unchanged)

Service 3 must expose identical observability capabilities:
- Pipeline tracker with status, timing, diagnostics for each stage.
- Data views:
  - raw (report:{report_id})
  - cleaned (report:{report_id}:canonical_raw)
  - validated (report:{report_id}:canonical_validated)
- Confidence display:
  - row-level confidence
  - overall_data_quality_score
- Error panel:
  - validation errors
  - missing values
  - unresolved anomalies
- Pattern panel with evidence trace.

## 9. Workflow States (Unchanged)

State sequence remains:
1. UPLOADED
2. PARSING
3. STRUCTURE_DETECTED
4. EXTRACTING
5. AGGREGATING
6. VALIDATING
7. LOW_CONFIDENCE
8. ANALYZING
9. GENERATING_REPORT
10. COMPLETED
11. FAILED

Rules unchanged:
- LOW_CONFIDENCE is terminal and not FAILED.
- ANALYZING requires validation gate pass.

## 10. Scaling Model with 3 Services

Independent scaling is preserved by running each consolidated service with separate worker pools and autoscaling targets:

- Service 1 scale key:
  - ingest throughput, parser CPU, extractor pool queue depth
- Service 2 scale key:
  - validation and analytics CPU, memory, batch comparative queue depth
- Service 3 scale key:
  - API QPS, report rendering throughput, websocket/polling load

Each service supports horizontal replicas while maintaining Redis key contract and idempotent stage writes.

## 11. Failure Domain Reduction

Improvements expected from consolidation:
- Fewer network hops and fewer HTTP timeout surfaces.
- Lower orchestration fragility.
- Smaller service discovery matrix.
- Reduced cross-service schema drift.

Behavioral guarantees unchanged:
- Same stage outputs and state transitions.
- Same gating outcomes for identical input data.

## 12. Migration Plan (No Behavioral Drift)

Phase 1: Module extraction without behavior changes
- Move current service logic into shared internal modules.
- Keep old service endpoints temporarily as compatibility facades.

Phase 2: Consolidated runtime activation
- Launch three consolidated services.
- Route jobs internally through queue topics.
- Keep Redis contracts and stage semantics unchanged.

Phase 3: Shadow validation
- Run old and new topologies in parallel on golden set.
- Compare outputs key-by-key and state-by-state.
- Block cutover on any contract or gate mismatch.

Phase 4: Cutover and decommission
- Switch traffic to consolidated services.
- Remove thin orchestrator hops and redundant service boundaries.

## 13. Equivalence Acceptance Criteria

Cutover is accepted only if all conditions pass:

1. For identical inputs, all required Redis keys exist with equivalent schema and semantics.
2. Validation gate pass/fail decisions are identical.
3. Workflow states and transitions are identical.
4. Frontend pipeline visibility and inspection views are complete and unchanged.
5. Batch eligibility and comparative outputs remain contract-compatible.
6. Performance improves in at least one of latency, error rate, or infra utilization with no quality regression.

## 14. Summary

The backend is reduced to three services by collapsing redundant boundaries, not logic.

- Service 1 owns ingestion and extraction.
- Service 2 owns data quality and intelligence.
- Service 3 owns reporting, delivery, and observability APIs.

Canonical data-first behavior remains exactly intact end to end.