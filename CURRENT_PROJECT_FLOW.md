# Current Project Flow (Data-First, Validation-Driven)

This document defines the target end-to-end architecture for financial report analysis. It supersedes prior analytics-first behavior and formalizes a data-first pipeline where validation and confidence govern downstream analytics and reporting.

## Consolidation Reference

For the approved three-service consolidation design (service boundary reduction only, no behavioral weakening), see:

- `THREE_SERVICE_CONSOLIDATED_ARCHITECTURE.md`

## 1. Final System Flow (Canonical)

PDF Upload
-> document_parser
-> structure_detector
-> extractors (parallel)
-> aggregation_service (new)
-> validation_engine (new)
-> canonical_dataset (new)
-> analytics layer
-> frontend inspection system
-> report_generator

## 2. Architecture Principles

1. Analytics must never run on raw extracted data.
2. Validation is a hard gate before analytics and report generation.
3. Every analytical value must be traceable to validated source rows.
4. Confidence is a first-class field at row level and output level.
5. The UI is data-observable: operators debug pipeline state through datasets, not logs.
6. Batch comparative analysis uses only validated, high-confidence data.

## 3. Runtime Topology

### 3.1 Orchestrator

- Node orchestrator manages upload, report lifecycle, workflow state transitions, and service invocation.
- Postgres stores durable report/company metadata and workflow status.
- Redis stores stage datasets, validation artifacts, confidence scores, analytics outputs, and final report payload.

### 3.2 Services

- Ingestion: `document_parser`, `structure_detector`
- Extraction: domain extractors + narrative extractors (parallel)
- Data quality: `aggregation_service` (new), `validation_engine` (new)
- Analytics: `ratio_calculator`, `kpi_sector_engine`, `pattern_detection`
- Generation: `report_generator`
- Batch comparative: `comparative_analysis` (validated/high-confidence input only)

## 4. Single Report Data Flow

### 4.1 Ingestion Layer

#### A) document_parser

- Input: `file_path`
- Output key: `report:{report_id}:document_chunks`
- Output contract:
  - `chunk_id`
  - `text`
  - `page_number`
  - `token_count`
  - `bbox` (optional)

#### B) structure_detector

- Input key: `report:{report_id}:document_chunks`
- Output key: `report:{report_id}:structure`
- Output contract:
  - `sections[]`
  - `detected_tables[]`
  - `statement_regions`
  - `narrative_regions`

### 4.2 Extraction Layer (Parallel)

All extractors must:

- Read from:
  - `report:{report_id}:document_chunks`
  - `report:{report_id}:structure`
- Execute in parallel using bounded async worker pools.
- Return normalized rows with mandatory provenance metadata.

Extractors:

- `income_statement_extractor`
- `balance_sheet_extractor`
- `cashflow_statement_extractor`
- `income_notes_extractor`
- `segment_extractor`
- `governance_extractor`
- `risk_extractor`
- `esg_extractor`
- `strategy_nlp`

Financial output writes:

- merged into `report:{report_id}`

Narrative output writes:

- `report:{report_id}:governance`
- `report:{report_id}:risk`
- `report:{report_id}:esg`
- `report:{report_id}:strategy`

Mandatory extracted row schema:

- `label`
- `value`
- `year`
- `entity_type`
- `statement_type`
- `source_chunk_id`
- `page_number`

Recommended additional fields:

- `unit`
- `currency`
- `raw_text`
- `extractor_name`
- `extraction_method`

## 5. Aggregation Layer (New)

Service: `aggregation_service`

Input:

- `report:{report_id}` (merged financial extraction payload)

Responsibilities:

1. Merge all statement rows from all financial extractors.
2. Remove duplicates across overlapping sources.
3. Normalize labels using canonical taxonomy (for example, "Total Revenue" -> `revenue`).
4. Align multi-year rows by canonical year axis.
5. Standardize schema and units.
6. Preserve lineage to original extraction rows.

Output key:

- `report:{report_id}:canonical_raw`

Canonical raw row contract:

- `row_id`
- `canonical_label`
- `original_label`
- `value`
- `year`
- `entity_type`
- `statement_type`
- `unit`
- `currency`
- `source_chunk_id`
- `page_number`
- `lineage` (array of source row references)

## 6. Validation Layer (New)

Service: `validation_engine`

Input key:

- `report:{report_id}:canonical_raw`

Responsibilities:

### 6.1 Financial Validation Rules

- Balance check: `assets ~= liabilities + equity` within configured tolerance.
- Profitability sanity: `revenue >= net_profit` unless explicit exception flags.
- Cashflow consistency checks (operating + investing + financing + fx + other adjustments align with net cash movement).

### 6.2 Cross-Statement Linking

- `net_income` <-> retained earnings movement.
- Cash closing balance in balance sheet <-> cashflow closing balance.
- Debt metrics <-> liabilities composition.

### 6.3 Data Cleaning

- Remove structurally invalid rows.
- Flag anomalies (outlier changes, impossible signs, label/value mismatches).
- Normalize units and scale (for example, thousands vs millions).

### 6.4 Confidence Scoring

Each row must include:

- `confidence_score` in [0, 1]
- `validation_flags[]`

Row confidence should combine:

- extraction confidence
- schema confidence
- rule-pass ratio
- cross-source agreement
- provenance quality

### 6.5 Global Quality Score

Generate:

- `overall_data_quality_score`

Score is computed from:

- coverage completeness
- critical-rule pass ratio
- conflict density
- unresolved anomaly burden

Output key:

- `report:{report_id}:canonical_validated`

Output payload must include:

- `validated_rows[]`
- `overall_data_quality_score`
- `validation_summary`
- `error_catalog`
- `missing_value_index`
- `confidence_distribution`

## 7. Canonical Dataset Contract (New)

The canonical dataset for downstream services is `report:{report_id}:canonical_validated`.

Required row fields:

- `canonical_label`
- `value`
- `year`
- `entity_type`
- `statement_type`
- `confidence_score`
- `validation_flags`
- `source_chunk_id`
- `page_number`

Consumers must treat this dataset as the single source of truth.

## 8. Analytics Gating (Critical)

Before any analytics service starts:

- Read `overall_data_quality_score`.
- Compare to configured threshold `ANALYTICS_QUALITY_THRESHOLD`.

Gate logic:

1. If `overall_data_quality_score < threshold`:
   - stop analytics execution
   - mark report status as `LOW_CONFIDENCE`
   - persist gating reason and remediation hints
2. Else:
   - continue to analytics layer

Mandatory rule:

- No analytics may consume `report:{report_id}` or `report:{report_id}:canonical_raw`.

## 9. Analytics Layer (Confidence-Aware)

Input key:

- `report:{report_id}:canonical_validated`

Services:

- `ratio_calculator`
- `kpi_sector_engine`
- `pattern_detection`

Execution rules:

1. Ignore rows below `MIN_ROW_CONFIDENCE_FOR_ANALYTICS`.
2. Propagate confidence into each computed metric/pattern.
3. Emit supporting evidence references to validated rows.

Output keys:

- `report:{report_id}:ratios`
- `report:{report_id}:sector_kpis`
- `report:{report_id}:patterns`

Output fields (minimum):

- `metric_or_pattern_name`
- `value`
- `confidence_score`
- `supporting_row_ids[]`
- `notes`

## 10. Frontend Inspection Layer (Mandatory)

The frontend must expose full pipeline transparency and dataset observability.

### 10.1 Pipeline Tracker

Display stage progression:

Upload -> Parsing -> Structure -> Extraction -> Aggregation -> Validation -> Analytics -> Report

Each stage must show:

- status (`pending|running|completed|failed|skipped`)
- start/end timestamps
- duration
- stage diagnostics

### 10.2 Data Views

1. Raw Data: `report:{report_id}`
2. Cleaned Data: `report:{report_id}:canonical_raw`
3. Validated Data: `report:{report_id}:canonical_validated`

The UI must support per-row drilldown to provenance (`source_chunk_id`, `page_number`, source snippet).

### 10.3 Confidence Display

- per-row `confidence_score`
- report-level `overall_data_quality_score`
- confidence filters and thresholds in the table view

### 10.4 Error Panel

Show:

- validation errors
- cross-statement inconsistencies
- missing critical values
- unresolved anomalies

### 10.5 Charts and Analytics Views

- Trends, comparisons, and ratio charts may render only from validated data.
- Charts must annotate confidence at series and point level where available.

### 10.6 Pattern Panel

For each detected pattern show:

- pattern description
- supporting data references
- confidence score
- rule/evidence trace

## 11. Report Generation Layer

Service: `report_generator`

Inputs:

- validated financial dataset
- confidence-aware ratios
- confidence-aware patterns
- validated narrative payloads (`governance`, `risk`, `esg`, `strategy`)

Rules:

1. Exclude low-confidence sections based on configured thresholds.
2. Include confidence indicators on all major sections and key figures.
3. Include a data quality summary and unresolved issue appendix.

Outputs:

- Redis: `report:{report_id}:final_report`
- File: generated PDF path saved in orchestration metadata

## 12. Batch Flow (Extended)

For batch upload:

1. Run the full single-report pipeline independently per report.
2. Enforce aggregation + validation + analytics gating per report.
3. Collect only reports with valid `canonical_validated` datasets.
4. Feed eligible reports into `comparative_analysis`.

Comparative analysis must use:

- only validated rows
- only rows and metrics meeting high-confidence thresholds

Comparative outputs must include:

- report eligibility summary
- excluded-report reasons
- confidence-weighted comparative metrics

## 13. Data Contracts and Redis Keyspace

Core keys:

- `report:{report_id}:document_chunks`
- `report:{report_id}:structure`
- `report:{report_id}`
- `report:{report_id}:governance`
- `report:{report_id}:risk`
- `report:{report_id}:esg`
- `report:{report_id}:strategy`
- `report:{report_id}:canonical_raw`
- `report:{report_id}:canonical_validated`
- `report:{report_id}:ratios`
- `report:{report_id}:sector_kpis`
- `report:{report_id}:patterns`
- `report:{report_id}:final_report`

Batch keys:

- `report:batch:{batch_id}:comparative`
- `report:batch:{batch_id}:eligibility`

Recommended metadata:

- `schema_version`
- `generated_at`
- `service_version`
- `source_report_id`

## 14. Workflow State Model (Updated)

Suggested state sequence:

1. `UPLOADED`
2. `PARSING`
3. `STRUCTURE_DETECTED`
4. `EXTRACTING`
5. `AGGREGATING`
6. `VALIDATING`
7. `LOW_CONFIDENCE` (terminal non-analytics path)
8. `ANALYZING`
9. `GENERATING_REPORT`
10. `COMPLETED`
11. `FAILED`

State rules:

- `LOW_CONFIDENCE` is not `FAILED`; it is a quality-gated terminal path.
- Transition to `ANALYZING` requires validation gate pass.

## 15. Observability by Data (Not Logs)

The platform must be debuggable via persisted stage data.

Minimum per-stage artifacts:

- stage input snapshot reference
- stage output key
- quality summary
- confidence summary
- error catalog

Debug UX requirement:

- Any report issue should be diagnosable by traversing stored datasets in order, without requiring backend logs.

## 16. Configuration Surface (New)

Recommended environment variables:

- `ANALYTICS_QUALITY_THRESHOLD` (for report-level gate)
- `MIN_ROW_CONFIDENCE_FOR_ANALYTICS`
- `REPORT_SECTION_CONFIDENCE_THRESHOLD`
- `VALIDATION_TOLERANCE_BALANCE_SHEET`
- `VALIDATION_TOLERANCE_CASHFLOW`
- `CANONICAL_SCHEMA_VERSION`

## 17. Critical Rules (Mandatory)

1. No analytics on raw extracted data.
2. All analytics must use validated dataset.
3. All dataset rows must carry `confidence_score` (or explicit non-applicable marker for pre-validation stages).
4. Frontend must expose full pipeline transparency.
5. System must be debuggable via data, not logs.

## 18. Final Expectation

The system is considered compliant when:

- extraction is modular and parallel
- aggregation and validation are mandatory pre-analytics stages
- analytics are confidence-aware and validation-gated
- frontend exposes full data pipeline visibility
- report accuracy is driven by validated data, not raw extraction
