# Current Project Flow and Intelligence Contract

Last updated: 2026-04-16

This document defines the required behavior of the financial document intelligence engine and maps that behavior to the current repository architecture.

## 1) Core Execution Principle

The platform must always execute end-to-end regardless of upload count.

1. Never block execution due to low document count.
2. Never require additional files in order to proceed.
3. Always extract, normalize, analyze, and report maximum possible value from available data.
4. When data depth is limited, continue pipeline execution and report limitations transparently.

## 2) Supported Input Variants

Users may upload:

1. One PDF.
2. Multiple PDFs from the same company.
3. Multiple PDFs across different years.
4. Inconsistently formatted files.
5. Scanned or text-native PDFs.

For every file, the system attempts to detect:

1. Company identity.
2. Reporting year.
3. Currency and scaling.
4. Statement sections and tables.
5. Narrative sections and audit text.

## 3) Runtime Components

1. nodeBackend (Express): public orchestration API and consolidated report retrieval.
2. extraction_service (FastAPI): PDF parsing, chunking, structure detection, extraction, canonical raw output.
3. analysis_service (FastAPI): canonical normalization, validation, ratio computation, pattern logic, risk signals, confidence scoring.
4. reporting_service (FastAPI): investor-style narrative assembly and final report payload creation.
5. pipeline_orchestrator plus worker (FastAPI plus Redis queue): async queue-based extraction lane.
6. Redis: runtime artifact store and pipeline stage state store.
7. Postgres: infrastructure dependency for broader platform features.

## 4) Processing Pipeline Contract

### 4.1 Document Intake

For each uploaded PDF, extraction must attempt:

1. Text extraction.
2. Table extraction and reconstruction.
3. Financial statement capture.
4. Notes to accounts capture.
5. Auditor and management narrative capture.

Pipeline resilience requirements:

1. OCR fallback for scanned content.
2. Multi-column handling.
3. Broken or merged row repair heuristics.
4. Best-effort extraction even when structure quality varies.

Output per file:

1. Structured JSON payload with extracted raw financial and narrative data.

### 4.2 Financial Normalization

Normalize into canonical financial schema:

1. Currency symbols and units.
2. Thousand/million/billion scaling.
3. Fiscal year labels.
4. Statement naming variations.

Canonical fields targeted:

1. Income statement core metrics.
2. Balance sheet core metrics.
3. Cash flow core metrics.

### 4.3 Multi-Year Aggregation

Aggregate all extracted documents into a chronologically aligned dataset.

If only one year exists:

1. Build single-year dataset.
2. Skip multi-year trend math only.
3. Mark trend outputs as limited by single-year scope.
4. Continue all other analytics and reporting stages.

If multiple years exist:

1. Order chronologically.
2. Align fiscal labels.
3. Detect missing-year gaps.

### 4.4 Ratio Engine

Always compute any ratio that can be computed from available data.

1. Profitability ratios.
2. Liquidity ratios.
3. Solvency ratios.
4. Efficiency ratios.
5. Growth ratios only when sufficient multi-year data exists.

If multi-year inputs are unavailable:

1. Return per-year available ratios.
2. Mark growth metrics as not available for current data scope.

### 4.5 Pattern and Trend Logic

If three or more years are available:

1. Detect directional and volatility trends.
2. Detect structural changes.
3. Detect acceleration or slowdown signals.

If fewer than three years are available:

1. Skip long-horizon trend detection.
2. Produce structural financial snapshot.
3. Produce ratio interpretation and single-period risk context.

### 4.6 Risk Analysis

Risk analysis is mandatory for every run, including single-document runs.

Evaluate at minimum:

1. Liquidity risk.
2. Leverage risk.
3. Profitability risk.
4. Cash flow risk.
5. Concentration risk.
6. Growth sustainability risk.

### 4.7 Transparency Layer

All outputs must state:

1. Number of uploaded PDFs.
2. Detected reporting years.
3. Which analyses were executed.
4. Which analyses were limited by data depth.

Required language style:

1. Never blame users for low volume.
2. Never require additional uploads to continue.
3. Use neutral limitation text such as trend analysis limited due to single reporting year.

## 5) Required Output Layers

### 5.1 Machine Output

Structured data including:

1. Extracted raw data.
2. Normalized dataset.
3. Ratios.
4. Risk scores or risk flags.
5. Trend flags where applicable.

### 5.2 Analytical Output

Human-readable interpretation including:

1. Financial health summary.
2. Ratio interpretation.
3. Risk interpretation.
4. Year-over-year comparison when available.

### 5.3 Report Output

Investor-ready narrative including:

1. Executive summary.
2. Company performance overview.
3. Financial analysis.
4. Risk analysis.
5. Data scope and limitation disclosure.

## 6) Current Node-Orchestrated Flow

Primary entry:

1. POST /reports (multipart field: report).

Execution sequence:

1. nodeBackend stores report metadata and uploaded file location.
2. nodeBackend triggers extraction_service POST /extract.
3. extraction_service writes report:{report_id}:canonical_raw.
4. nodeBackend triggers analysis_service POST /analyze.
5. analysis_service writes report:{report_id}:canonical_validated and analytics artifacts.
6. nodeBackend triggers reporting_service POST /generate-report.
7. reporting_service writes report:{report_id}:final_report.
8. nodeBackend returns consolidated payload through GET /reports/:reportId.

Retrieval endpoints:

1. GET /reports/:reportId
2. GET /reports/:reportId/download
3. GET /results/:reportId
4. GET /pipeline/:reportId/stages
5. GET /pipeline/:reportId/raw
6. GET /pipeline/:reportId/canonical
7. GET /pipeline/:reportId/validated
8. GET /pipeline/:reportId/analytics
9. GET /pipeline/:reportId/errors

## 7) Workflow State Model

workflow_state values derived from stage and artifact evidence:

1. FAILED
2. COMPLETED
3. LOW_CONFIDENCE
4. GENERATING_REPORT
5. ANALYZING
6. EXTRACTING
7. UPLOADED
8. PENDING

Frontend stage tracker:

1. UPLOAD
2. PARSING
3. STRUCTURE
4. EXTRACTION
5. AGGREGATION
6. VALIDATION
7. ANALYTICS
8. REPORT

## 8) Redis Artifact Keys

Single report keys:

1. report:{report_id}:document_chunks
2. report:{report_id}:structure
3. report:{report_id}
4. report:{report_id}:governance
5. report:{report_id}:risk
6. report:{report_id}:esg
7. report:{report_id}:strategy
8. report:{report_id}:canonical_raw
9. report:{report_id}:canonical_validated
10. report:{report_id}:ratios
11. report:{report_id}:sector_kpis
12. report:{report_id}:patterns
13. report:{report_id}:final_report

Batch keys:

1. report:batch:{batch_id}:comparative
2. report:batch:{batch_id}:eligibility

Support keys:

1. report:{report_id}:uploaded_file
2. report:{report_id}:meta
3. report:{report_id}:pipeline_stages
4. report:{report_id}:confidence
5. report:{report_id}:sector_comparison

## 9) Parallel Queue Lane

Queue-based API:

1. POST /submit
2. GET /status/{job_id}
3. GET /result/{job_id}

Queue sequence:

1. Store uploaded PDF in PIPELINE_TMP.
2. Push job to pipeline:jobs.
3. Persist QUEUED status.
4. Worker processes extraction and writes JSON output.
5. Persist COMPLETED with output path, or FAILED.

## 10) Non-Blocking Behavior Rules

Prohibited response patterns:

1. Upload more PDFs.
2. Insufficient data to proceed.
3. Analysis cannot be done.

Required response patterns:

1. Trend analysis limited due to single reporting year.
2. Multi-year pattern detection not available for current dataset.
3. Ratios and risk signals generated from available data.

## 11) Environment Variables

Core:

1. REDIS_URL
2. EXTRACTION_SERVICE_URL
3. ANALYSIS_SERVICE_URL
4. REPORTING_SERVICE_URL
5. NODE_BACKEND_PORT
6. EXTRACTION_SERVICE_PORT
7. ANALYSIS_SERVICE_PORT
8. REPORTING_SERVICE_PORT

Queue lane:

1. PIPELINE_ORCHESTRATOR_PORT
2. PIPELINE_TMP

## 12) Source of Truth

This file is the canonical contract and flow reference.
When behavior changes, update this file together with:

1. README.md
2. docs/architecture/DATA_FIRST_PROJECT_STRUCTURE.md
3. docs/architecture/DATA_FIRST_DEEP_SUMMARY.md