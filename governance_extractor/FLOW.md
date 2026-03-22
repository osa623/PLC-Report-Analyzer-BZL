# Governance Extractor - Flow Documentation

This document describes the processing flow for governance extraction.

## 1. Inputs
Incoming payload includes:
- `report_id`
- `file_path` (legacy compatibility field)

Primary extraction input:
- `report:{report_id}:document_chunks` from Redis

## 2. Process Flow

### A. API to Service
- FastAPI route calls `ExtractionService.process(...)`.

### B. Redis Chunk Loading
- Chunks are read from Redis.
- Missing chunks produces `missing_document_chunks_in_redis`.

### C. Governance Chunk Selection
- Service filters chunks using governance terms such as:
  - `governance`, `board of directors`, `committee`
  - `audit committee`, `risk committee`, `nomination`, `remuneration`
- If no matches are found, status is failed with `no_relevant_governance_chunks`.

### D. Parallel Gemini Calls
- Relevant chunks are processed in parallel.
- Each chunk returns governance-structured JSON.

### E. Merge and Transform
- Chunk payloads are merged into combined governance arrays:
  - `board_members`
  - `committees`
  - `executive_leadership`
  - `governance_policies`
- `TransformationService.transform(...)` outputs normalized governance records.

## 3. Outputs

### A. Persisted Payload
Stored via repository with:
- `statement_type`: `governance`
- `records`
- `metadata`: record count, governance section count, processed chunk count, error code

### B. API Response

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
