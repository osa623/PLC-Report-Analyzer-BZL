# ESG Extractor - Flow Documentation

This document describes the end-to-end flow for the ESG extractor service.

## 1. Inputs
The service receives:
- `report_id`
- `file_path` (compatibility field; extraction now uses Redis chunks)

Primary input source:
- `report:{report_id}:document_chunks`

## 2. Process Flow

### A. Request Handling
- FastAPI route forwards requests to `ExtractionService`.

### B. Chunk Acquisition
- Service fetches chunks from Redis.
- Missing chunk data results in `missing_document_chunks_in_redis`.

### C. ESG Relevance Filter
- Chunks are filtered by ESG-oriented terms including:
  - `esg`, `environmental`, `social`, `governance`
  - `sustainability`, `emission`, `carbon`, `diversity`
- No matching chunks causes failed status with `no_relevant_esg_chunks`.

### D. Parallel Chunk Extraction
- Matching chunks are sent to Gemini in parallel.
- `extract_chunk(...)` returns chunk-local ESG JSON (`categories -> items`).
- Individual chunk errors are logged while other chunk calls continue.

### E. Merge and Normalize
- Chunk outputs are merged by category.
- `TransformationService.transform(...)` converts mixed metric/narrative items into normalized records.
- Partial/ambiguous data marks status as `partial`.

## 3. Outputs

### A. Storage
Saved through repository with:
- `statement_type`: `esg`
- `records`: normalized ESG records
- `metadata`: record count, category count, processed chunks, error code

### B. API Response

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
