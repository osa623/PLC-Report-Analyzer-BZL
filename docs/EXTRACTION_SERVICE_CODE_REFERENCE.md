# THE CODE-LEVEL DEVELOPER REFERENCE: EXTRACTION SERVICE

This document is designed for developers who need to understand the **actual Python code** within the `extraction_service`. Instead of high-level summaries, we will look at the real code snippets from the primary files and explain exactly what they do line-by-line, and how you can modify them.

---

## 1. The Entry Point: `app.py`
This file is a FastAPI server. It defines the HTTP endpoints and handles the final mapping of data before it is shipped out of the extraction service.

### 🔑 Critical Code Snippet: Mandatory Fields
```python
MANDATORY_AUDIT_FIELDS = {
    "balance_sheet.total_assets",
    "balance_sheet.total_liabilities",
    "balance_sheet.total_equity",
    "income_statement.revenue_or_interest_income",
    "income_statement.net_profit",
}
```
**How it contributes:** If the pipeline fails to extract any of these exact fields, the entire extraction job is flagged as a failure or requires human auditing. 
**How to contribute:** If the business decides that "Operating Cash Flow" is now a strict requirement for every document, you must add `"cash_flow.operating_cash_flow"` to this set.

### 🔑 Critical Code Snippet: Requirement Validation (`require` vs `prefer`)
```python
def require(section: dict[str, Any], key: str, label: str) -> float:
    """Truly required field — blocks pipeline if missing."""
    value = _numeric_or_none(section.get(key))
    if value is None:
        missing_core.append(label)
        return 0.0
    return value

def prefer(section: dict[str, Any], key: str, label: str) -> float:
    """Preferred field — logged as info but does not block pipeline."""
    value = _numeric_or_none(section.get(key))
    if value is None:
        missing_optional.append(label)
        return 0.0
    return value
```
**How it contributes:** In `_build_financial_statement_model()`, the code uses these functions to pull data. If `require` fails, the document processing halts. If `prefer` fails, it just logs a warning (`missing_optional.append`) and continues.
**How to contribute:** When mapping a new field to the final `FinancialStatementModel`, you must decide if it is a `require()` or a `prefer()` based on business rules.

---

## 2. The AI Brain: `integrations/gemini_normalizer.py`
This file takes the messy output from PaddleOCR (which is just a massive list of X/Y coordinates and text) and asks Google Gemini to format it into a clean JSON dictionary.

### 🔑 Critical Code Snippet: Prompting the LLM
```python
prompt = (
    "You are a table-and-section normalizer.\n"
    "Input: a compressed representation of detected tables and entities from OCR.\n"
    "Task: Extract and align financial statement tables into the following JSON schema:"
    ' {"income_statement": {...}, "balance_sheet": {...}, "cash_flow": {...}, "notes": [...], "sections": [...], "confidence": 0.0 }\n'
    "Rules:\n"
    "- Return JSON only, no explanatory text.\n"
    "- For tables, align columns into key:year:value maps when possible.\n"
    "Input data (JSON):\n"
    f"{json.dumps(compressed)}\n"
)
resp = await call_gemini(prompt, max_output_tokens=2048)
```
**How it contributes:** This is the prompt that actually goes to Google. Notice the strict JSON schema it enforces (`{"income_statement": {...}}`). 
**How to contribute:** If PaddleOCR reads a new section (like "ESG Summary" or "Board of Directors"), Gemini will throw it away because it's not in the requested schema. To fix this, you must edit this prompt string to include `"esg_summary": {...}` so the LLM knows it is allowed to keep that data.

---

## 3. The Data Finders: `extractors/cashflow.py`
Once `gemini_normalizer.py` returns the clean JSON, the extractors loop through it to find specific business numbers. All extractors (balance sheet, income statement) follow a similar logic to this one.

### 🔑 Critical Code Snippet: Target Candidates
```python
candidates = {
    "Opening Cash": [
        "opening cash",
        "cash at beginning",
        "cash, beginning of period",
    ],
    "Net Cash Flow": [
        "net cash flow",
        "net change in cash",
        "net increase (decrease) in cash",
    ],
}
```
**How it contributes:** Financial institutions use different words for the same thing. Because the LLM might return `"cash at beginning": 5000`, this dictionary tells the codebase exactly which variations map to our official `"Opening Cash"` column.
**How to contribute:** If a Sri Lankan PLC report uses the phrase `"cash at start of year"` and the system is failing to extract it, you simply open this file and add `"cash at start of year"` to the array for `Opening Cash`.

### 🔑 Critical Code Snippet: Deterministic Fallbacks (Math Checks)
```python
if opening and net and (opening["value"] is not None) and (net["value"] is not None):
    calc_closing = opening["value"] + net["value"]
    if closing and closing.get("value") is None:
        closing["value"] = calc_closing # We calculate it ourselves!
    elif closing and closing.get("value") is not None:
        existing = closing["value"]
        if abs(existing - calc_closing) / max(abs(calc_closing), 1.0) > 0.01:
            # The math doesn't add up! Lower the confidence score.
            closing["confidence"] = min(closing.get("confidence", 1.0), 0.6)
```
**How it contributes:** This is brilliant fallback logic. If the extractor found the Opening Cash and the Net Cash, it knows what the Closing Cash *should* be (Opening + Net = Closing). If the OCR failed to read the Closing Cash row, the code just calculates it mathematically. If the OCR *did* read it, but the math doesn't add up, it lowers the "confidence" score, which flags it for human review.
**How to contribute:** When you add a new extractor, always look for mathematical relationships. For instance, in `balance_sheet.py`, you should write a snippet that ensures `Total Assets == Total Liabilities + Total Equity`.

---

## 4. The Enforcer: `strict_pipeline.py`
This file is the final gatekeeper before data is sent back to the main platform. It strips away dictionary keys and enforces the database schema.

### 🔑 Critical Code Snippet: Field Mapping
```python
RAW_TO_STRICT_FIELD_MAP: dict[str, dict[str, str]] = {
    "cash_flow": {
        "operating_cash_flow": "operating_cash_flow",
        "net_cash_flow": "net_cash_change",
        "opening_cash": "opening_cash",
        "closing_cash": "closing_cash",
    }
}
```
**How it contributes:** Look at `net_cash_flow`. In `cashflow.py` (above), the extractor calls it `"Net Cash Flow"`. But the database expects it to be called `"net_cash_change"`. This dictionary maps the extractor's output key to the final database key.
**How to contribute:** If you created a new search candidate in `cashflow.py` (e.g., you added logic to extract `"Dividends Paid"`), it will be deleted by the pipeline unless you come to `strict_pipeline.py` and add `"dividends_paid": "dividends_paid"` to this map.

### 🔑 Critical Code Snippet: Value Normalization
```python
def _to_lkr_millions(value: Any) -> float | None:
    if not _is_number(value):
        return None
    return round(float(value) / 1_000_000.0, 6)
```
**How it contributes:** If a report lists Revenue as `5,000,000,000`, this function divides it down to `5000.0`. It ensures our charts and UI uniformly display data in Millions of LKR. All values passing through `strict_pipeline.py` are routed through this function.

---

## Conclusion: The Lifecycle of a Contribution 

If your manager says: **"We need to start extracting 'Taxes Paid' from the Cashflow Statement."**

Here is exactly how you touch the code, step-by-step, using the actual snippets above:

1. You open `integrations/gemini_normalizer.py`. You look at the `prompt`. You confirm the prompt output schema (`"cash_flow": {...}`) is broad enough that Gemini will likely include taxes if it finds them. No changes needed here.
2. You open `extractors/cashflow.py`. You go to the `candidates` dictionary. You add:
   ```python
   "Taxes Paid": ["taxes paid", "income tax paid", "taxation paid"]
   ```
3. You open `strict_pipeline.py`. You go to `CASH_FLOW_FIELDS` and add `"taxes_paid"`.
4. Still in `strict_pipeline.py`, you go to `RAW_TO_STRICT_FIELD_MAP["cash_flow"]` and add:
   ```python
   "Taxes Paid": "taxes_paid"
   ```
5. You open `app.py`. You go to `_build_financial_statement_model()`. You decide if this feature is mandatory or optional. You write:
   ```python
   taxes_paid = prefer(cf, "taxes_paid", "cash_flow.taxes_paid")
   ```
   And you add `"taxes_paid": taxes_paid` to your final `model_seed` dictionary!