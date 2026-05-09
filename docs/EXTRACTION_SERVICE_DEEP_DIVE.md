# 🚀 The Ultimate Beginner's Guide to the Extraction Service (Deep Dive)

Welcome! If you asked for a more detailed, line-by-line understanding of our Extraction Service, you are in the right place. 

This guide pulls back the curtain on the actual Python files in the `d:\PLC-Report-Analyzer-BZL\services\extraction_service` directory. We will follow exactly how a PDF travels through our code, from the moment it is submitted until the moment the final financial data is mapped.

---

## 🗺️ The Complete A-Z Flow

When a new PDF is submitted, the code essentially follows these major steps:

1. **Job Tracking & Status (Redis):** The system notes that a task has started (`job_manager.py`).
2. **Text & Table Extraction (OCR):** The system uses an offline, free OCR engine (`PaddleOCR`) to read the text and tables from the PDF (`orchestrator.py`).
3. **Normalization (Gemini LLM):** The raw text is highly messy. We send it to an AI (Google Gemini) to align tables and fix semantic labels (`integrations/gemini_normalizer.py`).
4. **Domain-Specific Extraction (The Extractors):** Specialized scripts run through the cleaned data looking for exactly what they need (e.g., cash flow, balance sheet).
5. **Strict Mapping (The Validation):** The extracted numbers are double-checked, converted to the right formats (like LKR millions), and mapped to our strict database names (`strict_pipeline.py`).

Let's look at exactly which files do what, complete with actual code references.

---

## 1. 📢 Job Management: `job_manager.py`

When the system starts working on a report, the frontend (website) needs to know what is happening. `job_manager.py` acts as the loudspeaker. It uses **Redis** (an in-memory, super-fast database) to update the status.

**How it works:**
Whenever a major step starts, the code calls functions like this:
```python
def mark_running(redis, report_id: str) -> None:
    # Initialize all pipeline stages on first extraction run
    init_pipeline_stages(redis, report_id, 86400)
    update_pipeline_stage(redis, report_id, "EXTRACTION", "running", 86400)
```
If you want to add a *new* loading step to the website, you use `mark_substage(...)` inside your main processing script. The frontend constantly checks Redis for these string updates.

---

## 2. 🎼 The Maestro: `orchestrator.py`

This is the central nervous system of the extraction service. Open `orchestrator.py` and look for the main function: `extract_pdf_to_structured()`. 

**Step-by-step of `orchestrator.py`:**

1. **Hashing & Caching:** First, it creates a unique fingerprint (Hash) of the PDF. It checks the Cache (`integrations.cache.get_cached`): *Did we already process this exact PDF yesterday?* If yes, return the cached result instantly.
2. **PaddleOCR:** If it's a new PDF, it calls:
   ```python
   primary = await call_paddleocr(pdf_bytes)
   ```
   `PaddleOCR` is an offline computer vision tool that scans the PDF and turns images of spreadsheets into raw Python dictionaries.
3. **AI Normalization:** PaddleOCR is not perfect. Sometimes columns merge. The orchestrator takes the raw tables and sends them to Gemini:
   ```python
   gemini_resp = await call_gemini_normalizer(merged.get("structured") or {})
   ```
   Gemini looks at the tables, recognizes that it's a financial document, and returns a "Normalized" (clean) version.
4. **Running Extractors:** Next, the orchestrator passes the clean JSON to specialized scripts. 
   ```python
   from .extractors.cashflow import extract as extract_cashflow
   cashflow_results = extract_cashflow({"cash_flow": normalized.get("cash_flow", {})})
   ```

---

## 3. 🕵️ The Specialists: The `extractors/` folder

The orchestrator offloads the actual finding of specific data to the `extractors/` folder. Examples include `balance_sheet.py`, `cashflow.py`, and `income_statement.py`.

Inside these files, Python code iterates through the `normalized` JSON block provided by Gemini. Because Gemini already cleaned the data, the extractors usually just have to look for specific keywords and pull the numbers attached to them. 

* **Manual Changes Here:** If you want the system to extract a brand new field, say "Employee Count," you would create a new extractor (`extractors/employee_data.py`) or add it to an existing one. You tell it which keys from the Gemini output to search for.

---

## 4. 📏 The Rulebook: `strict_pipeline.py`

Financial data must be perfect. If the AI hallucinates, or the OCR reads a "0" as an "O", we need safety checks. `strict_pipeline.py` maps the extracted dictionary to a highly rigid structure.

If you open `strict_pipeline.py`, you'll see large mapping dictionaries:
```python
RAW_TO_STRICT_FIELD_MAP: dict[str, dict[str, str]] = {
    "balance_sheet": {
        "total_assets": "total_assets",
        "total_debt": "borrowings",
    },
    ...
}
```
**What does this do?** Even if Gemini returns a field named `total_debt`, our database requires this field to be named `borrowings`. This file acts as the ultimate translator ensuring consistency. 

It also contains math and data-type validations:
```python
def _to_lkr_millions(value: Any) -> float | None:
    if not _is_number(value):
        return None
    return round(float(value) / 1_000_000.0, 6)
```
This ensures all numbers are uniformly stored in Millions of LKR, allowing our analytics engines to do math without accidentally mixing billions and thousands.

* **Manual Changes Here:** If you added a new field in the Extractor (like "Employee Count"), you *must* add it to the `STRICT_SECTION_FIELDS` and mappings in `strict_pipeline.py`, or else it will be thrown away before it hits the database.

---

## 🧠 5. Calling the AI: `integrations/` and `llm/`

Our system talks to the outside world through the `integrations/` folder. 
* `paddleocr_client.py`: Controls how we ask the local PaddleOCR library to read images.
* `gemini_normalizer.py`: Formats our HTTP requests to Google's Gemini API securely using our API keys.
* `telemetry.py`: Logs how long things take. It tracks metrics like `PIPELINE_DURATION` and `CACHE_HITS` so we know if the service is running slow.

---

## 🛠️ Summary Walkthrough: How to safely add a new field

Let's pretend your boss wants you to start tracking **"Advertising Spend"** from the income statements. How do you do it?

1. **Step 1 (The LLM/Normalizer):** Ensure the prompt in `gemini_normalizer.py` (or the underlying prompts) is aware that "Advertising Spend" is important so it doesn't accidentally delete that row while cleaning the document.
2. **Step 2 (The Extractor):** Open `extractors/income_statement.py`. Find the logic pulling data from the normalized dictionary. Add logic to snag the "Advertising Spend" value out of the JSON.
3. **Step 3 (The Strict Mapping):** Open `strict_pipeline.py`. 
    * Add `"advertising_spend"` to `INCOME_STATEMENT_FIELDS`.
    * Map the raw name to the strict name in `RAW_TO_STRICT_FIELD_MAP["income_statement"]`.
4. **Step 4 (Test):** Run a single PDF through the terminal to watch `orchestrator.py` flow from PaddleOCR -> Gemini -> Extractor -> Strict Pipeline. 
5. **Step 5 (Database):** Make sure the downstream database (handled by `storage/` and the main platform) schema is updated to accommodate this new column!

Congratulations! You now understand the actual mechanical flow of the codebase. By tracing a PDF's journey from `job_manager.py` tracking, through `orchestrator.py` processing, into `extractors`, and finally sanitized by `strict_pipeline.py`, you can confidently find where any bug is happening or where any new feature needs to go.