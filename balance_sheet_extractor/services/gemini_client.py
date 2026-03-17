import json
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

BALANCE_SHEET_PROMPT = """
You are extracting data from an annual report PDF.

Task:
Extract the complete Balance Sheet (Statement of Financial Position).

Hard constraints:
- Return ONLY valid JSON. No markdown. No commentary.
- Preserve exact column headers exactly as printed (e.g. "2024 (Group)", "2023 (Company)").
- Include all rows without omission, including subtotals and totals.
- Maintain exact row order.
- Preserve exact row labels; do not rename labels.
- Capture hierarchy using indent_level and/or parent_label when possible.
- Include sections: Assets, Liabilities, Equity.
- Values must remain as strings exactly as shown in the table (including commas and parentheses).

Return this schema only:
{
  "statement_type": "balance_sheet",
  "currency": "string or null",
  "scale": "string or null",
  "rows": [
    {
      "label": "string",
      "values": {
        "<Exact Column Header>": "value as printed or null"
      },
      "section": "Assets|Liabilities|Equity|null",
      "subsection": "string or null",
      "parent_label": "string or null",
      "indent_level": 0,
      "note_reference": "string or null",
      "page_number": 1
    }
  ]
}
"""


class GeminiExtractor:
    """Gemini API client for strict JSON extraction of balance sheets."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)

    @staticmethod
    def _clean_json_text(text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        return cleaned

    @staticmethod
    def _extract_json_object(text: str) -> str:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return text
        return text[start : end + 1]

    def _parse_response(self, text: str) -> dict[str, Any]:
        cleaned = self._clean_json_text(text)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            parsed = json.loads(self._extract_json_object(cleaned))

        if not isinstance(parsed, dict):
            raise ValueError("Gemini response is not a JSON object")
        return parsed

    def extract_balance_sheet(self, file_path: str) -> dict[str, Any]:
        if not Path(file_path).exists():
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                uploaded_file = genai.upload_file(file_path, mime_type="application/pdf")
                response = self.model.generate_content(
                    [uploaded_file, BALANCE_SHEET_PROMPT],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
                return self._parse_response(response.text)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini extraction attempt %s failed: %s",
                    attempt + 1,
                    exc.__class__.__name__,
                )

        raise RuntimeError("Gemini extraction failed after retry") from last_error
