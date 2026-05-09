# 🛠️ THE DIY CONTRIBUTOR'S MANUAL: HOW THE EXTRACTION CODE WORKS 

If you want to write the code yourself, you need to know exactly what the code is doing under the hood. This manual strips away the theory and looks purely at the **code patterns**. 

We will go through every phase of the extraction pipeline, look at the actual Python code snippets that power it, and explain exactly how you can modify them manually.

---

## 1. THE ORCHESTRATOR (`services/extraction_service/orchestrator.py`)
This is the traffic cop. It doesn't extract anything itself; it simply passes the data from one script to the next.

### 🔍 The Core Code Snippet:
```python
async def extract_pdf_to_structured(json_output_path: str, pdf_bytes: bytes) -> Dict[str, Any]:
    # 1. OCR (Read the image)
    primary = await call_paddleocr(pdf_bytes)

    # 2. Normalize (Fix the messy text into JSON)
    gemini_resp = await call_gemini_normalizer(merged.get("structured") or {})
    normalized = gemini_resp.get("normalized")

    # 3. Extract (Run the specific domain scripts)
    try:
        from .extractors.cashflow import extract as extract_cashflow
        cashflow_results = extract_cashflow({"cash_flow": normalized.get("cash_flow", {})})
    except Exception:
        cashflow_results = None
```
*   **How it works:** It takes `pdf_bytes`, sends them to PaddleOCR, sends that result to Gemini to get a `normalized` JSON block, and then passes that clean JSON directly into your `extractors`.
*   **How to edit it manually:** If you create a brand new extractor (e.g., `extractors/esg.py`), you MUST open `orchestrator.py` and add `from .extractors.esg import extract as extract_esg`. Then, you pass `normalized.get("esg_data", {})` to it perfectly matching the pattern above.

---

## 2. THE NORMALIZER (`integrations/gemini_normalizer.py`)
This turns raw, messy PaddleOCR text into neat JSON.

### 🔍 The Core Code Snippet:
```python
    prompt = (
        "Task: Extract and align financial statement tables into the following JSON schema:"
        ' {"income_statement": {...}, "balance_sheet": {...}, "cash_flow": {...}, "notes": [...], "sections": [...], "confidence": 0.0 }\n'
        "Input data (JSON):\n"
        f"{json.dumps(compressed)}\n"
    )
```
*   **How it works:** It literally tells Google Gemini to output a strict JSON string. The keys in this JSON (`income_statement`, `balance_sheet`) are exactly what get passed into the `.get()` calls in `orchestrator.py`.
*   **How to edit it manually:** If you want Gemini to capture a new section of the report (e.g., the "Auditor's Report"), you must edit this prompt string to include `"auditor_report": {...}` inside the JSON schema definition. If you don't give Gemini the key, Gemini will throw the auditor data in the trash.

---

## 3. THE EXTRACTORS (`extractors/balance_sheet.py`, `income_statement.py`)
These files do the heavy lifting of finding specific financial rows. They all use the same core loop.

### 🔍 The Core Code Snippet:
```python
        candidates = {
            "Total Assets": [
                "total assets",
                "assets, total",
                "total fixed and current assets"
            ],
            "Current Liabilities": [
                "total current liabilities",
                "current liabilities"
            ]
        }
        
        for label, keys in candidates.items():
            for k in keys:
                for fk, fv in list(normalized_data.items()):
                    if isinstance(fk, str) and k in fk.lower():
                        # We found a match!
                        value = _parse_number(fv)
```
*   **How it works:** It loops through every key in the `candidates` dictionary. If the boss asked you to find "Total Assets", the code checks if the AI returned `"total assets"`, `"assets, total"`, etc. If it finds a match in the `normalized_data` dictionary, it saves it.
*   **How to edit it manually:** This is where you will spend 80% of your time! To add a new extracted value, simply open the corresponding extractor, go to the `candidates` dictionary, and add the English label the business wants, followed by an array of all the possible variations you might see in a raw document.

---

## 4. THE STRICT PIPELINE (`strict_pipeline.py`)
This is the database bouncer. It enforces exact naming conventions.

### 🔍 The Core Code Snippet:
```python
BALANCE_SHEET_FIELDS: tuple[str, ...] = (
    "total_assets",
    "total_liabilities",
    "current_assets",
)

RAW_TO_STRICT_FIELD_MAP: dict[str, dict[str, str]] = {
    "balance_sheet": {
        "Total Assets": "total_assets",
        "Current Liabilities": "current_liabilities",
        "Cash and Equivalents": "cash_and_equivalents"
    }
}
```
*   **How it works:** The extractors (from Step 3) output labels like `"Total Assets"`. But the database is programmed to ONLY accept `"total_assets"`. `RAW_TO_STRICT_FIELD_MAP` is the dictionary that translates them. `BALANCE_SHEET_FIELDS` is the strict whitelist of what is allowed to pass.
*   **How to edit it manually:** If you added a new candidate in Step 3 (e.g., `"Short Term Debt"`), it will be DELETED by `strict_pipeline.py` unless you manually add `"short_term_debt"` to the `TUPLE` and manually add `"Short Term Debt": "short_term_debt"` to the mapping dictionary.

---

## 5. THE DATA COMPILER (`app.py`)
This file wraps up all the extracted, strictly-mapped data and performs final validation before sending it off.

### 🔍 The Core Code Snippet:
```python
def _build_financial_statement_model(...) -> tuple[FinancialStatementModel, list[str]]:
    
    # REQUIRE means the pipeline will crash if this is missing!
    revenue = require(inc, "revenue_or_interest_income", "income_statement.revenue")
    
    # PREFER means the pipeline will just log a warning if this is missing!
    cost_of_sales = prefer(inc, "cost_of_revenue", "income_statement.cost_of_sales")

    # Math validations and automatic gap-filling
    if gross_profit is None and cost_of_sales is not None:
        gross_profit = revenue - cost_of_sales

    model_seed = {
        "report_id": report_id,
        "income_statement": {
            "revenue": revenue,
            "cost_of_sales": cost_of_sales,
            "gross_profit": gross_profit,
        }
    }
```
*   **How it works:** After `strict_pipeline.py` finishes cleaning the data, `app.py` retrieves it (`inc`). It runs the final `require()` and `prefer()` checks. If a required field is missing, the document is flagged for manual human audit. It also uses math to infer missing fields (e.g., Gross Profit = Revenue - Cost of Sales). Finally, it builds the `model_seed` dictionary.
*   **How to edit it manually:** When you create a new final field, you must come here to add it to the `model_seed`. You must decide: Is this field mandatory for the business (`require`), or optional (`prefer`)? You must physically code that decision here.

---

## 🚀 YOUR DIY CHECKLIST FOR ADDING A NEW FIELD

If you want to manually add a new extraction (e.g., "Research & Development Costs"), follow exactly this path:

1. **[ ] Go to `integrations/gemini_normalizer.py`:** Ensure the prompt schema allows for R&D costs.
2. **[ ] Go to `extractors/income_statement.py`:** Add `"R&D Costs": ["research and development", "r&d expenses"]` to the `candidates` dictionary.
3. **[ ] Go to `strict_pipeline.py`:** Add `"research_and_development"` to `INCOME_STATEMENT_FIELDS`, and map `"R&D Costs": "research_and_development"` in `RAW_TO_STRICT_FIELD_MAP`.
4. **[ ] Go to `app.py`:** Inside `_build_financial_statement_model`, add `rnd_costs = prefer(inc, "research_and_development", "...)`, and add `"research_and_development": rnd_costs` to your `model_seed`.

That is everything. You now know exactly where to put your cursor for every stage of the extraction.