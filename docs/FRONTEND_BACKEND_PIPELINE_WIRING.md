# Frontend / Backend Pipeline Wiring

This document explains how the uploaded annual report flow connects the frontend pages to the backend pipeline and where each data artifact is produced.

## Core Batch Flow

1. Frontend upload page calls `uploadReports(files)` in `frontend/src/lib/api.ts`.
2. Node route `POST /api/reports` in `nodeBackend/src/routes/pipelineRoutes.js` stores upload metadata in Redis and calls `triggerFullPipeline(reportId, uploadedPaths)`.
3. `triggerFullPipeline(...)` in `nodeBackend/src/services/pipelineClient.js` calls the Python orchestrator endpoint `POST /run-full-pipeline`.
4. `pipeline_orchestrator/full_pipeline.py` runs each PDF through `process_annual_reports(...)`.
5. For the completed batch, `_run_analysis_and_reporting_for_completed_batch(...)` calls `persist_normalized_results(...)`.
6. `persist_normalized_results(...)` writes `services/extraction_service/normalized_results.json`.
7. The orchestrator also stores the same normalized batch in Redis as `report:{report_id}:normalized_results`.
8. Analysis uses `load_canonical_analysis_dataset()`, which adapts `normalized_results.json`.
9. Reporting stores finalized dashboard/report artifacts in Redis.

## Entity Selection Rule

Financial values must prefer group-level data.

Rules:

- If a normalized year contains `group` or `consolidated`, the backend uses only those entity values.
- Standalone, parent, bank, company, or entity values are used only when no `group` or `consolidated` entity exists for that year.
- The strict analysis adapter applies this rule before ratio and chart calculations.
- The Node API applies the same rule before returning `normalized_grouped_results` to the frontend.

Code locations:

- Analysis selection: `services/extraction_service/strict_pipeline.py`
- Frontend display grouping: `nodeBackend/src/routes/pipelineRoutes.js`, function `selectPreferredNormalizedEntities(...)`

## Important Backend Artifacts

Redis keys used by the frontend:

- `report:{report_id}:uploaded_file`
- `report:{report_id}:uploaded_files`
- `report:{report_id}:document_statuses`
- `report:{report_id}:document_result:{pdf_name}`
- `report:{report_id}:normalized_results`
- `report:{report_id}:canonical_raw`
- `report:{report_id}:canonical_validated`
- `report:{report_id}:ratios`
- `report:{report_id}:patterns`
- `report:{report_id}:risk`
- `report:{report_id}:final_report`

Filesystem artifacts:

- `services/extraction_service/normalized_results.json`
- `pipeline_artifacts/{report_id}/{pdf_slug}/...png`
- `logs/{company}/{timestamp}/normalized_results.json`
- `logs/{company}/{timestamp}/analytics.json`
- `logs/{company}/{timestamp}/final_report.json`

## Node API Contract

`GET /api/reports/:reportId`

Used by dashboard and calculations pages.

Important response fields:

- `data_views.normalized_results`: raw normalized batch.
- `data_views.normalized_grouped_results`: backend-prepared display groups.
- `analytics.ratios`: finalized analysis ratios and chart inputs.
- `analytics.patterns`: finalized pattern outputs.
- `analytics.risk`: finalized risk outputs.
- `pipeline_status`: current derived status.

`GET /api/pipeline/:reportId/documents`

Used by processing, validation, and mapping pages.

Important response fields:

- `documents[].status`
- `documents[].statement_pages`
- `documents[].statement_images`
- `documents[].toc_pages`
- `documents[].statement_refs`
- `documents[].page_mappings`

`GET /api/pipeline/:reportId/documents/:pdfName/data`

Used when a page needs complete per-file extraction details.

Important response fields:

- `statement_images.toc`: TOC preview images.
- `normalized_grouped`: backend-prepared normalized groups for this PDF.
- `rows`: legacy flattened rows.
- `raw_result`: raw extraction details.

## Frontend Pages

### Upload Page

File:

- `frontend/src/routes/index.tsx`

Functions:

- Calls `uploadReports(files)`.
- Saves `report_id` in localStorage using `saveCurrentReport(...)`.

Backend:

- `POST /api/reports`
- Starts full pipeline through Python orchestrator.

### Processing Page

File:

- `frontend/src/routes/processing.tsx`

Functions:

- Calls `getPipelineStages(reportId)`.
- Calls `getDocumentStatuses(reportId)`.

Backend:

- `GET /api/pipeline/:reportId/stages`
- `GET /api/pipeline/:reportId/documents`

Purpose:

- Shows extraction/analysis/reporting status.
- Sends failed files to Mapping.

### Mapping Page

File:

- `frontend/src/routes/mapping.tsx`

Functions:

- Calls `getDocumentStatuses(reportId)`.
- Calls `getDocumentExtractedData(reportId, pdfName)` to hydrate full image metadata.
- Calls `retryDocumentExtraction(reportId, pdfName, selectedPages)`.

Backend:

- `GET /api/pipeline/:reportId/documents`
- `GET /api/pipeline/:reportId/documents/:pdfName/data`
- `POST /api/pipeline/:reportId/documents/:pdfName/retry-extraction`

TOC behavior:

- Backend saves detected TOC pages and each immediate next page under `statement_images.toc`.
- Mapping displays these images only on this page.
- Images include:
  - `kind: detected_toc`
  - `kind: next_page_after_toc`
  - `source_toc_page`
  - `page`
  - `url`

### Validation Page

File:

- `frontend/src/routes/validation.tsx`

Functions:

- Calls `getFullReport(reportId)`.
- Falls back to `getDocumentExtractedData(...)` if report-level normalized groups are not ready.

Backend:

- `GET /api/reports/:reportId`
- `GET /api/pipeline/:reportId/documents/:pdfName/data`

Display contract:

- Renders only backend-prepared `normalized_grouped_results` or per-file `normalized_grouped`.
- Structure:
  - annual report file
  - year
  - entity
  - statement
  - label/value rows

Validation does not display TOC screenshots.

### Dashboard Page

File:

- `frontend/src/routes/dashboard.index.tsx`

Functions:

- Calls `getFullReport(reportId)`.
- Reads `analytics.ratios.by_year`.

Backend:

- `GET /api/reports/:reportId`

Rules:

- Active uploads do not show ABC/mock charts while finalized analytics are missing.
- Charts render only when finalized `analytics.ratios.by_year` exists.

### Calculation Details Page

File:

- `frontend/src/routes/dashboard.calculations.tsx`

Functions:

- Calls `getFullReport(reportId)`.
- Renders `data_views.normalized_grouped_results` in the statement-wise tab.
- Renders `analytics.ratios.by_year` in the final calculations tab.

Backend:

- `GET /api/reports/:reportId`

Rules:

- Statement-wise extracted values come directly from backend grouped normalized data.
- Final ratios/calculations come from backend analysis output.

### Year, Pattern, Risk Drilldowns

Files:

- `frontend/src/routes/dashboard.year-analysis.tsx`
- `frontend/src/routes/dashboard.patterns.tsx`
- `frontend/src/routes/dashboard.risk.tsx`

Functions:

- Call `getFullReport(reportId)`.
- Use finalized backend analytics only for active uploaded reports.

Rules:

- If a real uploaded batch is active and analytics are not ready, these pages show a processing message instead of mock data.

## Backend Functions To Modify For Manual Work

TOC image behavior:

- `pipeline_orchestrator/full_pipeline.py`
- Function: `_save_statement_images(...)`

Normalized results persistence:

- `services/extraction_service/canonical_results.py`
- Function: `persist_normalized_results(...)`

Batch analysis trigger:

- `pipeline_orchestrator/full_pipeline.py`
- Function: `_run_analysis_and_reporting_for_completed_batch(...)`

Frontend response shaping:

- `nodeBackend/src/routes/pipelineRoutes.js`
- Functions:
  - `buildNormalizedGroupedResults(...)`
  - `displayNormalizedValue(...)`
  - route `GET /reports/:reportId`
  - route `GET /pipeline/:reportId/documents/:pdfName/data`

Pipeline start from upload:

- `nodeBackend/src/routes/pipelineRoutes.js`
- Route: `POST /reports`
- `nodeBackend/src/services/pipelineClient.js`
- Function: `triggerFullPipeline(...)`
