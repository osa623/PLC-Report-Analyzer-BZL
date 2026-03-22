# Balance Sheet Extractor - Flow Documentation

This document describes the end-to-end data flow for the `balance_sheet_extractor` service, which operates as a structure-aware, chunk-based extraction system.

## 1. Inputs
The primary entry point for this service is through the `/extract-financials` API endpoint (via `POST` request) or internally through the `ExtractionWorker`.

The service receives a standard input payload (`ProcessRequest`):
- **`report_id` (string)**: A unique identifier for the specific annual report being processed.
- **`file_path` (string)**: Deprecated, kept for backward compatibility but ignored. The service now reads data directly from Redis.

**Real Data Sources (Redis):**
- `report:{report_id}:document_chunks`: The pre-parsed text chunks of the report.
- `report:{report_id}:structure`: Structural and layout metadata of the document.

## 2. Total Process Flow
The process is orchestrated by several dedicated components:

### A. Routing and Orchestration
- The **FastAPI Router** (`api/routes.py`) accepts the request and forwards the `report_id` to the **`ExtractionService`**.

### B. Intelligent Chunk Filtering
- The **`ExtractionService`** fetches the document chunks from Redis.
- It applies keyword matching ("balance sheet", "assets", "liabilities", "equity") to filter down potentially hundreds of pages into only the relevant chunks containing financial statement data.

### C. Multi-Chunk Data Extraction (`GeminiExtractor`)
- Iterates over the filtered text chunks and processes them in parallel (using a thread pool).
- Sends each chunk independently to Google Gemini GenAI via the text-based `BALANCE_SHEET_CHUNK_PROMPT`.
- The prompt enforces partial extraction, guaranteeing the AI returns valid JSON schema mapping out the rows, columns, and indentations without failing on missing totals.

### D. Data Merging and Transformation (`TransformationService`)
- The raw JSON responses from all Gemini calls are passed into `TransformationService.merge_and_transform`.
- **Deduplication:** Merges redundant rows overlapping across chunks based on a unique key (`year`, `entity_type`, `label`, `section`).
- **Header Parsing:** Normalizes exact column headers into `year` (e.g., 2023) and `entity_type` (e.g., "group", "company").
- **Numeric Normalization:** Scopes out brackets, commas, N/A strings, converting everything uniformly to standard float types or `null`.
- **Hierarchy Reconstruction:** Rebuilds tree structures using `indent_level` offsets. Calculates `depth` and assigns the true `parent` label.
- **Semantic Tagging:** Contextually assigns the `semantic_type` (asset, liability, equity) based strictly on parent hierarchy logic rather than raw text labels.
- **Confidence Scoring:** Applies a heuristic score (0.0 - 1.0) observing missing values and structural irregularities.
- **Validation Layer:** Enforces the fundamental accounting equation (`Assets = Liabilities + Equity`) and validates that mandatory totals exist, emitting `validation_errors` otherwise.
- **Multi-Year Alignment:** Ensures cross-year completeness by padding missing fields with `null`.

## 3. Outputs and Destinations
Once the data is transformed, the service determines the status (`completed`, `partial`, or `failed`).

### A. Data Destination (Storage)
The final generated payload is persisted strictly into the **Redis Datastore** via `ReportRepository.persist_result()`, executing a `merge_section` on `"balance_sheet"`.

The payload persisted to Redis includes:
- `statement_type`: Explicitly set to `"balance_sheet"`.
- `status`: The final state of the job (`completed`, `partial`, or `failed`).
- `normalized_rows`: The final array of fully normalized, structured records (each including `confidence_score`, `source_chunk_id`, `depth`, etc.).
- `metadata`: Contains line counts, validation errors, processed chunk counts, and error codes.

### B. API Response Output
After storing the extensive JSON payload into Redis, the API endpoint responds immediately to the caller with a lightweight acknowledgment (`ProcessResponse`):
```json
{
  "report_id": "12345-abcde",
  "status": "completed"
}
```
*Note: Downstream services pull the full verified dataset out of Redis using `report_id`.*
