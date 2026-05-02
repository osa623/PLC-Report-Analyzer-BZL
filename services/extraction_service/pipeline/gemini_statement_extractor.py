import os
import json
import google.generativeai as genai
from typing import Any

# ==============================================================================
# L1 - EXTRACTION LAYER (PERCEPTION ONLY)
# ==============================================================================
# This layer is strictly for layout parsing and OCR.
# It does NOT perform:
# - Financial interpretation
# - Year detection
# - Mapping
# - Validation
# - Normalization
# ==============================================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def extract_financial_statements_from_text(
    full_text: str,
    file_path: str,
    report_id: str,
    strict_mode: bool = False,
    focus_fields: list[str] | None = None,
) -> dict[str, Any]:
    """
    Extracts raw structured tables from the provided text using Gemini.
    """
    if not GEMINI_API_KEY:
        # Fallback or mock behavior if no key is set, though in prod this shouldn't happen
        raise RuntimeError("GEMINI_API_KEY is not set")

    prompt = """
You are an OCR and layout extraction system.
Your ONLY job is to find financial tables in the provided text and extract them strictly as they appear.

CRITICAL RULES:
1. DO NOT interpret the data or change the meaning.
2. DO NOT map field names to standard labels. Keep the literal text exactly as it appears.
3. DO NOT guess years if they are missing. Use the literal column headers.
4. DO NOT change units, signs, or perform calculations.
5. DO NOT attempt to fix errors in the text.

Extract the following tables if present:
- Income Statement (or Statement of Profit or Loss)
- Balance Sheet (or Statement of Financial Position)
- Cash Flow Statement
- Statement of Changes in Equity

Return a JSON object with a single key 'tables' containing an array of table objects.
For each table found, use this schema:
{
  "statement_name": "The literal title found in the text",
  "columns": ["literal column header 1", "literal column header 2", "..."],
  "rows": [
     {
       "label": "literal row text exactly as it appears",
       "values": ["raw string value 1", "raw string value 2", "..."]
     }
  ]
}

If no tables are found, return {"tables": []}.
"""

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config={
            "temperature": 0.0,
            "response_mime_type": "application/json",
        }
    )

    try:
        response = model.generate_content([prompt, full_text])
        if response.text:
            payload = json.loads(response.text)
            tables = payload.get("tables", [])
        else:
            tables = []
    except Exception as e:
        return {
            "status": "failed",
            "report_id": report_id,
            "file_path": file_path,
            "failure_reason": f"Gemini extraction failed: {str(e)}",
            "extracted_tables": []
        }

    return {
        "status": "completed",
        "report_id": report_id,
        "file_path": file_path,
        "extracted_tables": tables
    }
