# Segment Extractor - Flow Documentation

This document describes the segment disclosure extraction flow.

## 1. Inputs
Incoming request fields:
- `report_id`
- `file_path` (legacy compatibility field)

Primary runtime data:
- `report:{report_id}:document_chunks` from Redis

## 2. Process Flow

### A. API Entry
- Request enters through FastAPI and is forwarded to `ExtractionService`.

### B. Chunk Retrieval
- Service reads document chunks by report id.
- Missing data triggers `missing_document_chunks_in_redis`.

### C. Segment Chunk Filtering
- Service keeps chunks likely containing segment disclosures:
  - `segment`, `business segment`, `geographical segment`
  - `segment revenue`, `segment result`, `operating segment`
- If no matching chunks are found, status becomes failed with `no_relevant_segment_chunks`.

### D. Parallel Chunk Extraction
- Relevant chunks are sent to Gemini concurrently.
- Each chunk returns segment JSON with rows grouped by segment.

### E. Merge and Normalization
- Chunk segment payloads are merged.
- `TransformationService.transform(...)` normalizes rows with segment type/name, year, hierarchy, and semantic tagging.
- Partial data is marked with `partial` status.

## 3. Outputs

### A. Persistence
Stored output includes:
- `statement_type`: `segment`
- `normalized_rows`
- `metadata`: row count, segment count, processed chunks, error code

### B. API Response

```json
{
  "report_id": "<report-id>",
  "status": "completed"
}
```
