# Income Notes Extractor - Flow Documentation

This document describes the end-to-end flow for extracting income-related notes.

## 1. Inputs
The service accepts:
- `report_id`
- `file_path` (legacy field retained for compatibility)

Primary source data:
- `report:{report_id}:document_chunks` from Redis

## 2. Process Flow

### A. Route and Service Dispatch
- FastAPI route invokes `ExtractionService.process(...)`.

### B. Redis Chunk Fetch
- Chunks are loaded from Redis by report id.
- If unavailable, extraction fails with `missing_document_chunks_in_redis`.

### C. Income Notes Chunk Filter
- Service filters likely income-note chunks using keywords such as:
  - `note`, `revenue`, `cost of sales`
  - `operating expense`, `other income`

### D. Concurrent Chunk Extraction
- Relevant chunks are sent to Gemini in parallel.
- `extract_chunk(...)` returns note fragments in strict JSON format.

### E. Merge and Normalize
- Chunk note payloads are merged into a single `notes` structure.
- `TransformationService.transform(...)` normalizes notes into row-level records.
- Partial parse situations set status to `partial`.

## 3. Outputs

### A. Storage
Persisted with:
- `statement_type`: `income_notes`
- `normalized_rows`
- `metadata`: row count, processed chunks, optional error code

### B. API Response

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
