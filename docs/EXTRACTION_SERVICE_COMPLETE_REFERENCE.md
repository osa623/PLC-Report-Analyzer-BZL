# THE COMPLETE DEVELOPER REFERENCE: EXTRACTION SERVICE

This is the exhaustive, file-by-file encyclopedia of the `extraction_service`. It covers absolutely every file in the directory, what it does, and how it interconnects. Finally, it provides comprehensive instructions on how to contribute to the code.

---

## PART 1: THE COMPLETE ARCHITECTURAL PIPELINE (How Data Flows)

1. **Ingestion (`app.py`):** Receives the Request with a PDF or PDF ID.
2. **State Management (`job_manager.py`):** Marks the job as `running` in Redis.
3. **Loading & Preprocessing (`pipeline/`):** Loads the PDF (`pdf_loader.py`), breaks it into pages/paragraphs (`chunker.py`), and identifies tables (`structure_detector.py`).
4. **Offline OCR (`integrations/paddleocr_client.py`):** Reads the raw characters and positions from the PDF entirely offline to avoid massive API costs. 
5. **LLM Normalization (`integrations/gemini_normalizer.py`):** Takes the messy PaddleOCR output and feeds it to Google Gemini to fix row alignments and give semantic labels (e.g., recognizing that "Tot Ast 2023" means "Total Assets").
6. **Domain Extraction (`extractors/`):** Dozens of specific scripts (e.g., `balance_sheet.py`, `cashflow.py`) parse the normalized JSON and pull out exactly their required fields.
7. **Strict Validation (`strict_pipeline.py`):** Data is checked to ensure numbers are valid floats, converted uniformly to millions, and mapped to the strict column names the database requires.
8. **Database Persistence (`storage/canonical_raw_repository.py` & `postgres_client.py`):** The clean data is heavily inserted into PostgreSQL.
9. **Finalization:** `job_manager.py` marks the job `completed`.

---

## PART 2: EXHAUSTIVE FILE-BY-FILE BREAKDOWN

### 📂 Root Directory (The Core Framework)
* **`app.py`**: The main web server (likely FastAPI or Flask). It defines the HTTP endpoints (like `/extract` or `/health`) that other services or triggers call to start a new extraction job.
* **`orchestrator.py`**: The "Maestro." It imports functions from `pipeline`, `integrations`, and `extractors`, wiring them together sequentially. The main function here dictates the big-picture order of operations.
* **`strict_pipeline.py`**: Contains the rigid `STRICT_SECTION_FIELDS` and `RAW_TO_STRICT_FIELD_MAP`. It is responsible for type-checking and translating whatever the LLM found into the exact schema required by the database. 
* **`job_manager.py`**: Handles updating Redis with the sub-stage status of the pipeline (e.g., `mark_running`, `mark_substage`). This gives real-time loading bar data to the frontend.
* **`config.py`**: Loads environment variables (`os.getenv`). Configuration for database URLs, LLM keys, and timeout settings live here.
* **`postgres_client.py` & `redis_client.py`**: Boilerplate database connection files. They establish connection pools so your service doesn't crash from opening thousands of database connections simultaneously.
* **`Dockerfile` & `requirements.txt`**: Infrastructure files. `requirements.txt` lists the Python packages being used (like `paddleocr`, `redis`, `psycopg2`). `Dockerfile` builds the service into an isolated Linux container for deployment.

### 📂 `extractors/` (The Domain Specialists)
Each file here is responsible for parsing the Gemini-normalized JSON for a specific section of a financial report.
* **`__init__.py`**: Exposes the extractors to the rest of the application.
* **`balance_sheet.py`**: Extracts Assets, Liabilities, and Equity.
* **`cashflow.py`**: Extracts Operating, Investing, and Financing Cash Flows.
* **`income_statement.py`**: Extracts Revenue, Cost of Sales, Gross Margin, Net Income.
* **`equity.py`**: Tracks changes in retained earnings and shareholder equity.
* **`esg.py`**: Scans for Environmental, Social, and Governance metrics.
* **`governance.py`**: Pulls board member details or compliance metrics.
* **`notes.py`**: Parses the textual "Notes to the Financial Statements" which describe accounting policies.
* **`risk.py`**: Extracts key liquidity, credit, or market risk disclosures.
* **`segment.py`**: Pulls out revenue breakdowns by geography or product segment.

### 📂 `integrations/` (Third-Party Services)
Tools that communicate outside the container.
* **`cache.py`**: Wraps Redis to save duplicate PDF hashes. If you process a PDF on Monday, and again on Tuesday, this prevents re-running it.
* **`telemetry.py`**: Tracks execution time and errors (e.g., `PIPELINE_DURATION`) for monitoring dashboards like Grafana or Datadog.
* **`paddleocr_client.py`**: Uses PaddleOCR for offline text recognition. Highly critical for free first-pass table reading.
* **`gemini_normalizer.py`**: Calls the Gemini API. It sends the PaddleOCR output and receives back the "normalized" JSON tree.
* **`anthropic_client.py`**, **`openai_client.py`**, **`gemini_client.py`**: Low-level HTTP wrappers. They handle the API keys and make the actual `POST` requests to Claude, ChatGPT, or Gemini.
* **`document_ai_client.py` & `textract_client.py`**: (Likely alternate or legacy OCR fallback options to Google DocAI or AWS Textract).

### 📂 `llm/` (Prompt & Request Management)
* **`client.py`**: A generic wrapper that lets the system swap between OpenAI/Gemini/Anthropic easily depending on what `config.py` says.
* **`prompt_loader.py`**: Very important file! It reads text templates. Instead of hardcoding prompts like "You are an AI...", the code uses this loader to fetch the template and inject the OCR text into it.
* **`retry_policy.py`**: Implements exponential back-off. If OpenAI is down and returns a 503 error, this file tells the code to wait 2 seconds, try again, wait 4 seconds, etc.

### 📂 `pipeline/` (PDF Manipulation)
* **`pdf_loader.py`**: Connects to S3/Blob storage or local disk, reads the `pdf_bytes`, and validates that the file is not empty or corrupted.
* **`chunker.py`**: LLMs cannot process 300 pages at once. This script breaks document text down into smaller logic blocks.
* **`structure_detector.py`**: Uses heuristics or machine learning to detect "Ah, page 15 has a Balance Sheet table, but page 16 is just text." 
* **`parallel_extraction_runner.py`**: Instead of running `balance_sheet.py` then waiting, then running `cashflow.py`, this script uses `asyncio` to run all extractors at the exact same time to save 80% of the extraction time.
* **`gemini_statement_extractor.py`**: Co-locates specific logic for identifying exactly where financial statements start and end using Gemini.

### 📂 `storage/`
* **`canonical_raw_repository.py`**: Executes the actual SQL `INSERT`/`UPDATE` queries into PostgreSQL after `strict_pipeline.py` has verified everything is completely perfect.

### 📂 `tests/`
* **`test_balance_sheet.py`, `test_cashflow.py`, `test_income_statement.py`**: Uses unit testing (`pytest`) to pass fake JSON blocks into the extractors and asserts they map fields properly without breaking.

---

## PART 3: HOW TO CONTRIBUTE TO THE FLOW (Step-By-Step Developer Guide)

Here are the most common scenarios you will face when contributing code to the Extraction Pipeline, and the exact steps to complete them successfully.

### 🛠️ SCENARIO 1: Adding a Brand New Metric (e.g., "EBITDA")

If you are asked to extract a new data point from the Income Statement, do exactly this:

1. **Step 1:** Open `strict_pipeline.py`. 
    * Find `INCOME_STATEMENT_FIELDS` and add `"ebitda"`.
    * Go to `RAW_TO_STRICT_FIELD_MAP["income_statement"]` and map the expected JSON key to the strict key: `"ebitda": "ebitda"`.
2. **Step 2:** Open `extractors/income_statement.py`. 
    * Add the Python logic inside the extractor to pull `ebitda` from the normalized `json` object. E.g., `ebitda_val = normalized_data.get("ebitda")`.
3. **Step 3 (If necessary):** Open `llm/prompt_loader.py` or look at your Gemini normalizer prompts. Ensure the LLM knows it is *supposed* to be capturing EBITDA. If the prompt just says "Extract Revenue," it won't grab EBITDA. Update the prompt string.
4. **Step 4:** Open the Database Schema (`database/schema.sql` at the root of the repo) and make sure an `ebitda NUMERIC` column actually exists in the table.
5. **Step 5:** Open `tests/test_income_statement.py` and write a quick test proving your new extractor logic pulls `ebitda` out of a dummy JSON payload correctly. 

### 🛠️ SCENARIO 2: Fixing an LLM Hallucination Map

Often, the LLM will extract something correctly, but use a weird name, like returning `"Total Current Liabilities"` as `"current_liab_total"`. This breaks the system because your database expects `"current_liabilities"`.

1. **Step 1:** Identify the failure. You will usually see a validation error in your terminal or `strict_pipeline.py` complaining about a mismatched key.
2. **Step 2:** Open `strict_pipeline.py`.
3. **Step 3:** Go to `RAW_TO_STRICT_FIELD_MAP["balance_sheet"]`. 
4. **Step 4:** Map the hallucination back to the allowed key. If you can't guarantee what the LLM will output, you may need to update the `extractors/balance_sheet.py` to check for multiple possible keys (`data.get("current_liabilities") or data.get("current_liab_total")`).
5. **Step 5:** Add the fallback safely.

### 🛠️ SCENARIO 3: Tracking a New Sub-Stage on the Frontend

If processing is taking too long on `paddleocr_client.py` and you want the user to know "We are currently running OCR...", you need to add a tracker.

1. **Step 1:** Open `orchestrator.py` and find exactly where you are calling PaddleOCR.
2. **Step 2:** Import `mark_substage` from `job_manager.py`.
3. **Step 3:** Directly before `paddleocr_client.call_paddleocr()`, insert this line:
   `mark_substage(redis_client, report_id, "ocr_processing", "running")`
4. **Step 4:** Directly after the call finishes, insert:
   `mark_substage(redis_client, report_id, "ocr_processing", "completed")`

### 🛠️ SCENARIO 4: Changing LLM Providers

If the company gets too expensive using Anthropic and you need to switch everything to Gemini:
1. **Step 1:** Open `config.py` and change the default LLM engine variable.
2. **Step 2:** Open `llm/client.py`. 
3. **Step 3:** Reroute the internal `generate()` function to instantiate from `integrations.gemini_client` instead of `openai_client`. Ensure the response parsing maps Google's response object to the strict internal pipeline expectations.

### ⚠️ THE NON-NEGOTIABLE STRICT RULES OF CONTRIBUTIONS
* **NEVER bypass `strict_pipeline.py`**: Do not ever write data straight from `extractors/` to `storage/`. It MUST go through strict validation, formatting (`_to_lkr_millions`), and type casting.
* **Always verify against `tests/`**: If you change an extractor, run the pytest suite. Breakages in core extractors have massive downstream ripple effects.
* **Keep Prompts Versioned**: If you update anything in `llm/prompt_loader.py`, ensure you communicate the change. LLM behavior changes drastically with one changed word in a prompt constraint.