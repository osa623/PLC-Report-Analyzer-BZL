# Current Project Flow and Intelligence Contract

Last updated: 2026-06-01

This document is the implementation-aligned workflow, data contract, and project plan for the current annual-report intelligence platform. It explains how the system moves from upload to extraction, analysis, reporting, and retrieval, including the current formulas, thresholds, artifacts, and limiting rules.

## 1) Purpose

The platform turns one or more annual-report PDFs into a structured financial intelligence package that includes:

- extracted raw statement data
- normalized multi-year financials
- validation results
- ratio calculations
- pattern detection
- risk scoring
- sector benchmarking
- investor-style reporting
- PDF and JSON outputs for downstream consumers

The system is designed to keep moving even when the document set is small, incomplete, or partially malformed.

## 2) Core Execution Rules

The system must always execute end-to-end if there is any usable data.

- Never block the pipeline just because the upload count is low.
- Never require additional files before continuing.
- Always extract, normalize, validate, analyze, and report what can be supported by the available data.
- When a metric is unavailable, the pipeline records the limitation instead of failing the whole run.
- When advanced analytics are gated, the system falls back to structural snapshots and transparency text.

## 3) Runtime Components

### 3.1 Node backend

`nodeBackend` is the public orchestration layer.

- Accepts uploads
- Creates and tracks `report_id`
- Calls the extraction, analysis, and reporting services
- Serves status and artifact retrieval endpoints
- Converts Redis-backed pipeline state into frontend-ready responses

### 3.2 Extraction service

`services/extraction_service` parses the uploaded PDFs and produces canonical raw financial data.

- Handles text-native and scanned PDFs
- Detects tables, statements, notes, and narrative sections
- Performs OCR fallback when necessary
- Reconstructs tables and statement structure
- Writes extracted artifacts for later stages

### 3.3 Analysis service

`services/analysis_service` takes extracted financial data and produces validated analytics.

- Merges yearly data
- Normalizes units and scale drift
- Runs hard accounting gates
- Computes ratios and growth metrics
- Produces confidence, risk, sector comparison, and pattern outputs
- Writes the canonical validated dataset and analytics artifacts

### 3.4 Reporting service

`services/reporting_service` turns the validated analysis into a final investor-style report.

- Builds a strict report structure
- Generates narrative sections
- Builds charts and tables
- Writes a PDF report when the PDF toolchain is available
- Stores the final report in Redis and on disk

### 3.5 Auxiliary queue lane

The repository also includes a queue-based pipeline lane for asynchronous processing.

- `POST /submit`
- `GET /status/{job_id}`
- `GET /result/{job_id}`

This lane runs in parallel to the primary Node-orchestrated flow and uses queue state plus worker output.

## 4) Supported Input Variants

The platform accepts:

- one PDF
- multiple PDFs from the same company
- multiple PDFs across different years
- inconsistent formatting across files
- scanned PDFs
- text-based PDFs

For each file, the system attempts to infer:

- company identity
- reporting year
- currency
- unit scaling
- statement sections
- notes and narrative sections
- auditor and governance text

## 5) End-to-End Workflow

### 5.1 Upload and job creation

Primary upload endpoint:

- `POST /reports`

The request uses multipart uploads with field name `report` and accepts multiple files.

What happens next:

1. Node backend accepts the upload and creates a `report_id`.
2. Metadata about the upload is persisted.
3. The uploaded file paths are stored for later service calls.
4. The pipeline status is initialized in Redis.
5. The extraction service is triggered first.

### 5.2 Extraction stage

The extraction stage is responsible for converting PDF content into raw structured financial data.

Typical extraction flow:

1. Read the PDF bytes or file reference.
2. Detect document structure and relevant pages.
3. Extract text and tables.
4. Repair split or merged rows when needed.
5. Apply OCR fallback for scanned content.
6. Detect statements and notes.
7. Map extracted values into canonical raw fields.
8. Persist the raw extracted artifact.

Outputs at this stage:

- raw document-level extraction payloads
- canonical raw statement data
- extracted narrative and note sections
- extraction coverage and confidence artifacts

### 5.3 Analysis stage

The analysis service is triggered after extraction.

Typical analysis flow:

1. Load extracted documents from Redis, MongoDB, or local fallback data.
2. Merge yearly documents into a chronological financial dataset.
3. Normalize obvious scale drift.
4. Stabilize cross-statement inconsistencies.
5. Run hard validation gates.
6. Create a canonical raw report object.
7. Run schema, accounting, cross-statement, and anomaly checks.
8. Run self-correction where applicable.
9. Save the canonical validated report.
10. Compute ratios, patterns, confidence, risk, and sector comparison.
11. Save analytics artifacts and analysis coverage metadata.
12. Return a completed analysis status with transparency data.

### 5.4 Reporting stage

The reporting service is triggered once analysis data exists.

Typical reporting flow:

1. Load strict extraction and strict analysis payloads.
2. Build a strict report object.
3. Load validated data, ratios, patterns, confidence, sector comparison, risk, and analysis coverage.
4. Generate narrative content.
5. Build chart data.
6. Compose the final report sections.
7. Write a PDF report if supported by the environment.
8. Store the final report payload in Redis.
9. Delete temporary financial statement storage after the report is generated.
10. Mark the job completed.

### 5.5 Retrieval stage

The node backend exposes consolidated retrieval endpoints:

- `GET /status/:reportId`
- `GET /reports/:reportId`
- `GET /reports/:reportId/download`
- `GET /results/:reportId`
- `GET /pipeline/:reportId/stages`
- `GET /pipeline/:reportId/raw`
- `GET /pipeline/:reportId/canonical`
- `GET /pipeline/:reportId/validated`
- `GET /pipeline/:reportId/analytics`
- `GET /pipeline/:reportId/errors`
- `GET /pipeline/:reportId/documents`

These endpoints are backed by Redis artifacts written by the pipeline stages.

## 6) Canonical Data Structures

### 6.1 Upload and pipeline metadata

Typical report metadata stored in Redis includes:

- `report_id`
- `document_count`
- `uploaded_file`
- `meta`
- pipeline stage state
- upload timestamps

### 6.2 Per-document extraction payload

Each extracted document typically carries:

- `year`
- `balance_sheet`
- `income_statement`
- `cashflow_statement`
- `equity_statement`
- `currency`
- `unit_multiplier`
- `unit_detected`
- `source_file`
- `extraction_confidence`
- `metrics_extracted_count`

### 6.3 Merged yearly analysis model

The analysis service merges documents into a normalized multi-year structure with fields such as:

- `years`
- `financials`
- `restatement_events`
- `duplicate_year_merges`
- `comparative_availability`
- `data_gaps`
- `post_extraction_flags`
- `required_metrics_count`

### 6.4 Canonical raw report

The canonical raw report is stored under `report:{report_id}:canonical_raw`.

It is the structured object used as the input to validation and correction.

### 6.5 Canonical validated report

The validated report is stored under `report:{report_id}:canonical_validated`.

It represents the corrected and validated version of the canonical raw report plus:

- deterministic checks
- validation issues
- corrected financial statements
- downstream-ready financial rows

### 6.6 Analysis artifacts

The main analytics payloads are:

- `ratios`
- `patterns`
- `confidence`
- `risk`
- `sector_comparison`
- `analysis_coverage`
- `data_reliability_report`

### 6.7 Final report payload

The report service writes a final report payload that contains:

- `report_id`
- `status`
- `strict_report`
- `validated`
- `ratios`
- `patterns`
- `risk`
- `confidence`
- `sector_comparison`
- `analysis_coverage`
- `sections`
- `transparency`
- `chart_data`
- optional `pdf_report_path`

## 7) Analysis Service Deep Dive

### 7.1 Data source resolution

When `POST /analyze` runs, the service resolves data in this order:

1. MongoDB `companies` collection
2. `fetch_temporary_financial_statements(report_id)`
3. local `normalize.json` fallback

This means the analysis service can still execute even if one storage path is unavailable.

### 7.2 Year merge and normalization

The service merges the yearly documents into a common view before analytics.

Key normalization behavior:

- years are sorted numerically when possible
- statement sections are merged by year
- `revenue_or_interest_income` is treated as the revenue anchor
- `net_profit` is aligned across statement sources
- duplicate year collisions are tracked as restatement events

#### Scale drift normalization

The system attempts to correct obvious unit drift across years.

For each metric path:

- `balance_sheet.total_assets`
- `balance_sheet.total_liabilities`
- `balance_sheet.total_equity`
- `income_statement.revenue_or_interest_income`
- `income_statement.net_profit`
- `cashflow_statement.operating_cash_flow`
- `cashflow_statement.opening_cash`
- `cashflow_statement.net_cash_change`
- `cashflow_statement.closing_cash`

It compares observed magnitudes and tests multipliers:

- `1`
- `1e2`
- `1e3`
- `1e4`
- `1e6`
- `1e-2`
- `1e-3`
- `1e-4`
- `1e-6`

The multiplier is applied only when:

- the original mismatch is large enough, and
- the corrected value materially improves the fit

### 7.3 Cross-statement stabilization

The analysis service also attempts to stabilize consistency across statements.

Rules:

- if assets and liabilities exist, equity can be imputed as `assets - liabilities`
- if net profit is known, cashflow net income is aligned to income statement net profit when the difference is too large
- equity net income and retained earnings change are also aligned to income statement net profit when needed

### 7.4 Hard validation gates

The analysis service uses five hard gates.

#### Gate 1: Balance sheet identity

Checks whether:

- `assets ≈ liabilities + equity`

Failure threshold:

- relative difference > `0.03`

#### Gate 2: Cash reconciliation

Checks whether:

- `opening_cash + net_cash_change ≈ closing_cash`

Failure threshold:

- relative difference > `0.03`

If one of the three cash legs is missing, the service may infer it from the other two.

#### Gate 3: Net income linkage

Checks consistency across:

- income statement net profit
- cashflow net income
- equity-statement net income or retained earnings change

Failure threshold:

- relative difference > `0.03`

#### Gate 4: Multi-year continuity

Tracks year-over-year jumps for:

- total assets
- revenue or interest income
- total equity

Rule:

- if `abs(yoy) > 3.0 * year_gap`, the gate fails

#### Gate 5: Unit consistency

Fails when the merged dataset contains:

- more than one currency
- more than one unit multiplier across years

### 7.5 Ratio eligibility gate

The ratio engine runs only when a year has at least five required metrics.

Required metrics:

- `total_assets`
- `total_liabilities`
- `total_equity`
- `net_profit`
- `revenue_or_interest_income`

If no year reaches the threshold, ratio analytics are blocked.

### 7.6 Ratio engine formulas

The ratio engine produces a per-year normalized ratio map and a latest-year view.

#### Growth metrics

- `revenue_growth_yoy = (rev_t - rev_t-1) / abs(rev_t-1)`
- `net_profit_growth_yoy = (np_t - np_t-1) / abs(np_t-1)`
- `operating_profit_growth_yoy = (op_t - op_t-1) / abs(op_t-1)`
- `eps_growth_yoy = (eps_t - eps_t-1) / abs(eps_t-1)`
- `asset_growth_yoy = (assets_t - assets_t-1) / abs(assets_t-1)`
- `equity_growth_yoy = (equity_t - equity_t-1) / abs(equity_t-1)`
- `earnings_growth_rate = net_profit YoY`
- `net_asset_growth_rate = equity YoY`
- `revenue_cagr` / `profit_cagr` / `asset_growth_rate` / `equity_growth_rate` are produced as multi-year growth rates when enough history exists

The multi-year growth formula is:

- `((last / first)^(1 / periods)) - 1`

#### Profitability and efficiency

- `gross_profit_margin = gross_profit / revenue`
- `net_profit_margin = net_profit / revenue`
- `effective_tax_rate = tax_expense / profit_before_tax`
- `operating_expense_ratio = operating_expenses / revenue`
- `return_on_equity = net_profit / avg(equity_t, equity_t-1)` with current-equity fallback
- `return_on_assets = net_profit / avg(assets_t, assets_t-1)` with current-asset fallback
- `equity_ratio = equity / assets`
- `net_asset_value = equity`
- `tangible_net_worth = equity - intangible_assets` when intangible assets exist
- `capital_employed = assets - current_liabilities`
- `ebit_growth_vs_revenue_growth = operating_profit_growth_yoy / revenue_growth_yoy`
- `expense_elasticity = operating_expenses_growth_yoy / revenue_growth_yoy`

#### Liquidity and solvency

- `current_ratio = current_assets / current_liabilities`
- `quick_ratio = (current_assets - inventory) / current_liabilities`
- `cash_ratio = cash / current_liabilities`
- `debt_to_equity = debt / equity`
- `debt_ratio = debt / assets`
- `equity_buffer_ratio = equity / liabilities`
- `ocf_to_debt_ratio = operating_cash_flow / debt`
- `interest_coverage = operating_profit / interest_expense`

#### Cash quality

- `net_cash_flow = operating_cash_flow + investing_cash_flow + financing_cash_flow`
- `total_cash_flow = same as net_cash_flow`
- `cash_flow_to_net_income = operating_cash_flow / net_profit`
- `operating_cash_flow_margin = operating_cash_flow / revenue`
- `cash_return_on_assets = operating_cash_flow / assets`
- `cash_return_on_equity = operating_cash_flow / equity`
- `cash_interest_coverage = operating_cash_flow / interest_expense`
- `free_cash_flow = operating_cash_flow - capex_proxy`
- `capex_proxy` uses explicit capex when available, otherwise uses absolute investing cash flow when investing CF is negative

#### Shareholder and market metrics

- `eps`
- `book_value_per_share`
- `dividend_per_share`
- `dividend_payout_ratio = dividends_paid / net_profit`
- `dividend_coverage_ratio = net_profit / dividends_paid`
- `earnings_yield = eps / price`
- `price_to_earnings_ratio = price / eps`
- `price_to_book_ratio = price / book_value_per_share`
- `dividend_yield = dividend_per_share / price`
- `market_capitalization = price * shares_outstanding`
- `enterprise_value = market_capitalization + debt - cash`

#### Additional balance and sector metrics

- `net_debt_issued_repaid = debt_t - debt_t-1`
- `net_interest_income`
- `loan_to_deposit_ratio`
- `operating_income_total`

### 7.7 Ratio guardrails

The service nullifies extreme or out-of-range values.

Current guardrails:

- `revenue_growth_yoy` outside `[-0.50, 1.50]`
- `net_profit_growth_yoy` outside `[-0.50, 1.50]`
- `roe` outside `[-0.50, 0.60]`
- `debt_to_equity` outside `[0.0, 10.0]`
- `interest_coverage` outside `[0.0, 50.0]`

### 7.8 KPI engine

The KPI engine currently exposes:

- `net_income`
- `net_cash_flow`

These are lightweight support values used by confidence and reporting layers.

### 7.9 Confidence score

The confidence score combines validation quality, completeness, unit consistency, year coverage, extraction quality, and issue density.

Key components:

- `validation_pass_rate`
- `statement_completeness`
- `ratio_coverage`
- `year_coverage`
- `unit_consistency`
- `multi_year_continuity`
- `re_extraction_success_rate`
- `extraction_confidence_component`
- `extraction_agreement_component`
- `issue_density_penalty`
- `hard_fail_penalty`

#### Current formula

The confidence engine computes:

- `ratio_coverage = numeric_ratio_count / 12` for the confidence module’s expected ratio set
- `year_coverage = len(numeric_years) / 3`
- `validation_pass_rate = passed_gates / total_gates`
- `statement_completeness = present_core_metrics / required_core_metrics`
- `re_extraction_success_rate = 1 - ((avg_attempts - 1) / 3)`
- `issue_density_penalty = min(0.35, weighted_issue_count / evidence_volume)`
- `hard_fail_penalty = min(0.40, hard_fail_count * 0.12)`

Evidence weighting inside the confidence score:

- `0.24 * validation_pass_rate`
- `0.18 * completeness`
- `0.14 * ratio_coverage`
- `0.10 * year_coverage`
- `0.08 * unit_consistency`
- `0.08 * continuity`
- `0.07 * re_extraction_success_rate`
- `0.06 * extraction_confidence_score`
- `0.05 * extraction_agreement_score`

Penalties:

- subtract issue density
- subtract hard validation failures
- subtract `0.10` if no ratios exist
- subtract `0.08` if no KPIs exist

Output band:

- `high` if score >= `0.8`
- `medium` if score >= `0.6`
- `low` otherwise

### 7.10 Risk score

The risk engine converts core weakness signals into a composite 0-100 score.

Component weights:

- profitability strength: `0.20`
- liquidity strength: `0.15`
- debt risk: `0.20`
- cashflow health: `0.20`
- growth stability: `0.15`
- accounting red flags: `0.10`

Threshold behavior:

- low profitability margins increase risk
- low current ratio increases risk
- high debt-to-equity increases risk
- weak cashflow-to-net-income increases risk
- negative or unstable growth increases risk
- forensic red flags increase risk based on the number of flags

Final score:

- `overall_risk_score = weighted_score_0_1 * 100`

Bands:

- `low` = `0-30`
- `moderate` = `31-60`
- `high` = `61-100`

Additional outputs:

- `risk_scores`
- `risk_levels`
- `risk_flags`
- `known_signal_coverage`
- `final_financial_health_score`
- compatibility alias `risk_rating`

### 7.11 Sector comparison

The current sector comparison is intentionally small and benchmark-driven.

Benchmarks:

- `current_ratio = 1.5`
- `debt_to_assets = 0.55`
- `return_on_assets = 0.08`

Output:

- `benchmarks`
- `delta`

Each delta is:

- `actual - benchmark`

### 7.12 Pattern engine

Pattern detection is rule-based and uses both ratio history and validation issues.

When three or more years are available, the engine can detect:

- upward trend
- downward trend
- volatile trend
- structurally stable trend
- consistent multi-year growth pattern
- persistent top-line contraction pattern
- cyclical revenue behavior
- margin expansion trend
- margin compression trend
- rising debt dependency pattern
- profit rising while cash conversion is weakening
- revenue acceleration with improved asset productivity
- debt rising faster than revenue momentum
- volatility spike in revenue growth trajectory

When fewer than three years are available, the engine emits structural fallback messages:

- trend analysis limited due to single reporting year
- multi-year pattern detection not available for current dataset
- long-horizon trend detection limited because fewer than three reporting years are available
- structural financial snapshot generated from available periods
- risk interpretation generated from available ratio coverage

Additional pattern sources:

- validation friction detected
- re-extraction recommended
- forensic flags from the ratio engine

If nothing else is detected, the fallback pattern is:

- stable reporting pattern

### 7.13 Transparency and coverage outputs

The analysis service writes:

- `report:{report_id}:analysis_coverage`
- `report:{report_id}:data_reliability_report`
- `report:{report_id}:confidence`
- `report:{report_id}:risk`
- `report:{report_id}:sector_comparison`
- `report:{report_id}:patterns`
- `report:{report_id}:ratios`

The transparency payload includes:

- number of uploaded documents
- detected reporting years
- which analysis layers executed
- which analysis layers were limited

### 7.14 Analysis service final response

The current `/analyze` response includes:

- `status`
- `report_id`
- `validation_issues`
- `reextraction_required`
- `detected_years`
- `transparency`
- `metrics_coverage`

## 8) Reporting Service Deep Dive

### 8.1 Inputs

The report service reads:

- `report:{report_id}:strict_extraction`
- `report:{report_id}:strict_analysis`
- `report:{report_id}:canonical_validated`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:confidence`
- `report:{report_id}:sector_comparison`
- `report:{report_id}:risk`
- `report:{report_id}:analysis_coverage`

### 8.2 Strict report builder

`build_strict_report(...)` assembles a reporting-friendly data package from extraction and analysis.

It produces:

- statement tables
- ratio tables
- key findings
- anomalies
- validation summary
- financial health score
- risk score
- evaluated equations by year

The strict report is the bridge between low-level analytics and presentation content.

### 8.3 Transparency model

The reporting service builds a transparency object with:

- valid years
- rejected years
- validation flags
- metrics coverage
- confidence band
- confidence score

### 8.4 Narrative generation

`generate_narrative(...)` produces the investor-oriented text payload.

It creates:

- `executive_summary`
- `financial_health_overview`
- `ratio_analysis`
- `risk_analysis`
- `risk_governance_insights`
- `sector_comparison`
- `confidence_data_quality`
- `pattern_summary`
- `data_scope_and_limitations`
- `investor_report`

Narrative logic includes:

- a bull case when net profit margin is strong
- a bull case when current ratio is healthy
- a bear case when overall risk is elevated
- a bear case when forensic flags exist
- sector-specific interpretation text based on detected business profile

### 8.5 Section composition

`compose_sections(...)` returns two major section trees:

- `investor_grade_report`
- `institutional_research_report`

It also preserves a legacy report structure with:

- executive summary
- company performance overview
- financial analysis
- risk analysis
- risk governance insights
- limitations disclosure
- confidence and quality view
- charts

### 8.6 Chart generation

`build_chart_data(...)` generates:

- `required_charts`
- `ratio_chart`
- `trend_chart`

Required chart coverage includes:

- revenue trend
- net income
- gross profit margin
- net profit margin
- return on equity
- return on assets
- debt to equity
- current ratio
- total assets
- total liabilities
- total equity
- total cash flow

### 8.7 PDF output

When the environment supports ReportLab, the reporting service writes:

- `data/eval/{report_id}.report.pdf`

The PDF contains:

- cover page
- headline metrics
- validation and reliability views
- charts
- ratio summaries
- risk sections
- narrative sections

### 8.8 Final storage and cleanup

After report generation:

- the final report payload is stored in Redis under `report:{report_id}:final_report`
- the same payload is also persisted through the final report repository
- temporary financial statements are deleted
- the service logs a temporary-storage lifecycle record
- the job is marked successful

### 8.9 Reporting service response

The `/generate-report` endpoint returns the full report payload, including:

- strict report
- validated data
- ratios
- patterns
- risk
- confidence
- sector comparison
- analysis coverage
- sections
- transparency
- chart data
- optional PDF path

## 9) Redis Keys and Artifacts

### 9.1 Core report keys

- `report:{report_id}:meta`
- `report:{report_id}:uploaded_file`
- `report:{report_id}:pipeline_stages`
- `report:{report_id}:confidence`
- `report:{report_id}:canonical_raw`
- `report:{report_id}:canonical_validated`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:risk`
- `report:{report_id}:sector_comparison`
- `report:{report_id}:analysis_coverage`
- `report:{report_id}:final_report`
- `report:{report_id}:strict_report`

### 9.2 Analysis-stage keys

- `report:{report_id}:raw_extracted_values`
- `report:{report_id}:normalized_values`
- `report:{report_id}:reconstructed_statements`
- `report:{report_id}:data_reliability_report`
- `report:{report_id}:extraction_coverage`
- `report:{report_id}:temporary_storage_lifecycle`

### 9.3 Extraction-stage keys

- `report:{report_id}:document_chunks`
- `report:{report_id}:structure`
- `report:{report_id}:governance`
- `report:{report_id}:risk`
- `report:{report_id}:esg`
- `report:{report_id}:strategy`

### 9.4 Batch keys

- `report:batch:{batch_id}:comparative`
- `report:batch:{batch_id}:eligibility`

### 9.5 Support keys

- `report:{report_id}:sector_comparison`
- `report:{report_id}:confidence`
- `report:{report_id}:pipeline_stages`

## 10) Workflow State Model

### 10.1 Workflow states

Derived workflow states:

- `FAILED`
- `COMPLETED`
- `LOW_CONFIDENCE`
- `GENERATING_REPORT`
- `ANALYZING`
- `EXTRACTING`
- `UPLOADED`
- `PENDING`

### 10.2 Frontend stage tracker

Frontend-visible stages:

- `UPLOAD`
- `PARSING`
- `STRUCTURE`
- `EXTRACTION`
- `AGGREGATION`
- `VALIDATION`
- `ANALYTICS`
- `REPORT`

## 11) Non-Blocking Behavior Rules

### 11.1 Prohibited response patterns

The system should not respond with:

- upload more PDFs
- insufficient data to proceed
- analysis cannot be done

### 11.2 Required response patterns

The system should respond with neutral limitation language such as:

- trend analysis limited due to single reporting year
- multi-year pattern detection not available for current dataset
- long-horizon trend detection limited because fewer than three reporting years were detected
- structural financial snapshot generated from available data
- risk interpretation generated from available ratio coverage

### 11.3 When limitations are expected

Limitations are expected when:

- only one year exists
- fewer than three years exist
- hard validation fails
- ratio coverage is too low
- risk coverage is too low
- sector coverage is too low

## 12) Current Project Plan

This is the implementation plan for keeping the platform maintainable and production-ready.

### Phase 1: Lock the contracts

Goal: make the current data model explicit and stable.

- finalize the canonical raw and validated report shapes
- document every Redis key used by the pipeline
- align Node, analysis, and reporting payloads
- standardize the frontend stage and workflow-state mapping

Deliverables:

- contract document updated
- payload shape examples added
- breaking-change checklist defined

### Phase 2: Tighten extraction fidelity

Goal: improve the quality of the raw financial capture.

- expand statement detection heuristics
- improve OCR fallback handling
- refine table reconstruction rules
- increase note and narrative extraction coverage
- improve year and currency detection

Deliverables:

- stronger raw extraction coverage
- more complete document-level artifact storage
- lower extraction failure rate

### Phase 3: Strengthen analysis reliability

Goal: make multi-year analytics more trustworthy.

- refine unit normalization
- reduce false restatement detection
- improve cross-statement stabilization
- add more robust missing-value handling
- review guardrail thresholds against real company data

Deliverables:

- fewer restricted-mode runs
- more stable ratio outputs
- more reliable confidence and risk scores

### Phase 4: Expand pattern intelligence

Goal: make pattern outputs more useful and less brittle.

- extend multi-year trend detection
- separate structural patterns from forensic signals more clearly
- add clearer pattern severity labels
- tune fallbacks for 1-year and 2-year datasets

Deliverables:

- better pattern summaries
- clearer investor-facing narrative support
- more explainable anomaly messaging

### Phase 5: Improve reporting quality

Goal: make the report more decision-ready.

- enrich narrative templates
- improve chart selection and chart labels
- add clearer limitations language
- review PDF layout and presentation hierarchy
- ensure report sections are consistent across runs

Deliverables:

- stronger final report structure
- better PDF readability
- more stable report generation under partial data

### Phase 6: Harden orchestration and observability

Goal: make it easier to operate and debug the pipeline.

- improve stage logging
- track failure reasons by stage
- expose more useful status snapshots
- make Redis artifact lookup more transparent
- add more useful operational metadata

Deliverables:

- easier support and debugging
- clearer stage-by-stage pipeline visibility
- better recovery from partial failures

### Phase 7: Testing and regression coverage

Goal: protect the current behavior while the system evolves.

- add fixture-based tests for ratio formulas
- add tests for hard validation gates
- add tests for report composition and narrative fallbacks
- add tests for confidence and risk scoring boundaries
- add tests for one-year and multi-year scenarios

Deliverables:

- regression safety for analytics
- repeatable validation for report output
- confidence in future refactors

### Phase 8: Release hardening

Goal: prepare the workflow for stable rollout.

- confirm Redis TTL behavior
- confirm cleanup of temporary storage
- review file deletion after report generation
- validate PDF generation in target environments
- document runbooks and rollback guidance

Deliverables:

- release checklist
- rollback playbook
- operational runbook

## 13) Source of Truth

This file is the current workflow contract for the platform.

If behavior changes, update this document together with:

1. `README.md`
2. `docs/architecture/DATA_FIRST_PROJECT_STRUCTURE.md`
3. `docs/architecture/DATA_FIRST_DEEP_SUMMARY.md`
4. `docs/CURRENT_SYSTEM_CALCULATIONS.md`

