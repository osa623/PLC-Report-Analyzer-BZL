# Cash Flow Statement Extractor - Flow Documentation

This document describes the end-to-end data flow for the `cashflow_statement_extractor` service, which operates on the exact same structure-aware, parallel chunk-based foundation as the balance sheet extractor.

## 1. Inputs
The primary entry point for this service is through the `/extract-financials` API endpoint (via `POST` request) or internally via the generic `ExtractionWorker`.

The service receives an input payload:
- **`report_id` (string)**: A unique identifier for the specific annual report.
- **`file_path` (string)**: Deprecated, ignored.

**Real Data Sources (Redis):**
- `report:{report_id}:document_chunks`: Pre-parsed text chunks containing the document's content.
- `report:{report_id}:structure`: Optional layout structure metadata.

## 2. Total Process Flow
The processing is executed in discrete, parallel stages:

### A. Routing and Validation
- The incoming request passes through the **FastAPI Router** (`api/routes.py`) into the **`ExtractionService`**.

### B. Heuristic Chunk Filtering
- The **`ExtractionService`** fetches all document chunks from Redis in one query.
- It scans the text context to retain only chunks referencing `"cash flow"`, `"operating activities"`, `"investing activities"`, or `"financing activities"`. This instantly ignores 95% of the annual report.

### C. Multi-Chunk Parallel Extraction (`GeminiExtractor`)
- Survived chunks are submitted concurrently to the Gemini GenAI model via a thread pool.
- The `CASHFLOW_CHUNK_PROMPT` enforces a partial-JSON extraction protocol forcing Gemini to structure rows correctly while explicitly ignoring statements denominated in USD.
- Missing totals or clipped sections are tolerated to allow fragments of the table to safely return.

### D. Data Merging and Transformation (`TransformationService`)
- The asynchronous extraction payloads return to the core loop and pass through `TransformationService.merge_and_transform`.
- **Deduplication:** Merges identical, overlapping rows found in differing chunks.
- **Header Parsing:** Normalizes exact headers (e.g., 2024 Group, 2023 Company).
- **Semantics:** Flags `"operating"`, `"investing"`, and `"financing"` sections safely and infers parent hierarchy hierarchies via `indent_level`.
- **Math Verification:** A strict constraint dictates that `Operating + Investing + Financing = Net Increase/Decrease in Cash`. If this fails or totals are wholly missing, the state is marked as `partial`.
- **Multi-Year Padding:** Guarantees all years possess matching schema shapes by injecting `null` into missing timeline cells.

## 3. Outputs and Destinations

### A. Data Destination (Storage)
The finalized output is handed to the `ReportRepository` datastore gateway. Data is pushed to Redis executing an atomic `merge_section` on `"cashflow_statement"`.

Stored payload shape:
- `statement_type`: `"cashflow_statement"`
- `status`: `"completed"`, `"partial"`, or `"failed"`.
- `normalized_rows`: The unified, cleaned data elements with individual `confidence_score` arrays.
- `metadata`: Execution metrics matching the balance sheet format.

### B. API Response Output
Following successful storage down to Redis, a compact completion payload releases back to the API requestor:
```json
{
  "report_id": "12345-abcde",
  "status": "completed"
}
```
*Downstream dependencies automatically query the Redis store for analytical patterns.*
