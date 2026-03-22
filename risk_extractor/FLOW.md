# Risk Extractor - Flow Documentation

This document describes the risk extraction flow.

## 1. Inputs
The service consumes:
- `report_id`
- `file_path` (kept for compatibility)

Primary data source:
- `report:{report_id}:document_chunks` in Redis

## 2. Process Flow

### A. Routing
- FastAPI route forwards request to `ExtractionService`.

### B. Redis Data Load
- Service reads report chunks from Redis.
- Missing chunks triggers `missing_document_chunks_in_redis`.

### C. Risk-Focused Chunk Filtering
- Chunk text is filtered using risk signals including:
  - `risk`, `principal risk`, `risk management`
  - `financial risk`, `operational risk`, `market risk`, `regulatory risk`
- No relevant chunks returns failed status with `no_relevant_risk_chunks`.

### D. Parallel Gemini Extraction
- Relevant chunks are extracted concurrently with `extract_chunk(...)`.
- Chunk-level failures are logged and skipped.

### E. Merge and Transform
- All chunk risk arrays are merged into a single `risks` payload.
- `TransformationService.transform(...)` normalizes category/title/description/severity records.

## 3. Outputs

### A. Stored Payload
Persisted payload includes:
- `statement_type`: `risk`
- `records`
- `metadata`: record count, risk count, processed chunks, error code

### B. API Response

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
