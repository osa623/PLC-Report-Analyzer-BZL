# Income Statement Extractor - Flow Documentation

This document describes the end-to-end flow for the income statement extractor service.

## 1. Inputs
The service accepts requests through `/extract-financials` and receives:
- `report_id`: Unique report identifier.
- `file_path`: Kept for compatibility, but no longer required for extraction logic.

Primary runtime input source is Redis:
- `report:{report_id}:document_chunks`

## 2. Process Flow

### A. Routing and Orchestration
- FastAPI route delegates processing to `ExtractionService.process(report_id, file_path)`.

### B. Chunk Fetching
- `ExtractionService` loads document chunks from Redis.
- If chunks are missing, the run fails with `missing_document_chunks_in_redis`.

### C. Relevance Filtering
- Chunk text is filtered with income-statement keywords such as:
  - `income statement`
  - `statement of profit or loss`
  - `revenue`, `gross profit`, `operating profit`
- If no relevant chunks are found, status becomes failed with `no_relevant_income_statement_chunks`.

### D. Parallel Gemini Chunk Extraction
- Relevant chunks are processed concurrently using a thread pool.
- Each chunk is sent to Gemini via `GeminiExtractor.extract_chunk(...)` with strict JSON output constraints.
- Failed chunk calls are logged and do not stop other chunks.

### E. Merge and Transformation
- Chunk-level JSON payloads are merged into one statement payload.
- `TransformationService.transform(...)` normalizes rows into structured records.
- If partial parsing is detected, status becomes `partial`.

## 3. Outputs

### A. Persisted Output
The service stores results through `ReportRepository.persist_result(...)` with:
- `statement_type`: `income_statement`
- `status`: `completed`, `partial`, or `failed`
- `normalized_rows`: normalized income statement records
- `metadata`: row count, processed chunk count, and optional error code

### B. API Response
The API returns a lightweight status response:

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
