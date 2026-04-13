import json
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

BALANCE_SHEET_CHUNK_PROMPT = """
You are a forensic financial data extractor.

Task:
Extract any Balance Sheet (Statement of Financial Position) line items found in this text chunk.

CRITICAL DATA EXTRACTION RULES:

1. CURRENCY DETECTION:
   - You must detect the currency of the table.
   - Look for headers like "Rs 000", "Rs '000", "Rs. '000", "Rs Ths", "Rs Thousands", "Rs Mn", "Rs Mill", "LKR '000", "LKR Mn".
   - IGNORE tables where the header or footnote says "USD", "US$", "In US Dollars", or similar. If the table is in USD, return "currency_skipped": true and empty rows.
   - Output `detected_currency`: "LKR" (or "USD" if ignored).

2. SCALE NORMALIZATION:
   - The canonical unit for this system is "Rs 000" (Thousands of LKR).
   - "Rs Mn" or "Rs Million" -> output `scale_multiplier`: 1000.
   - "Rs Bn" or "Rs Billion" -> output `scale_multiplier`: 1000000.
   - "Rs 000" or "Rs '000" -> output `scale_multiplier`: 1.
   - Output `scale_multiplier`: The number you multiply the column by to get Rs '000.

3. REQUIRED FIELD: TOTAL ASSETS
   - You MUST extract the line item "Total Assets" (or "Total Assets").
   - It usually appears after the last asset line item (e.g., Other Assets).
   - Do NOT miss this line. It is CRITICAL.

Rules you MUST follow:
- TWO YEARS: Each table has columns for current year (e.g. 2024) and prior year (e.g. 2023). Extract BOTH columns.
- MISSING = NULL: If a value is not present, return null. Do NOT interpolate or estimate.
- NEGATIVE VALUES: Expense items may appear in parentheses (123,456) which means -123,456. Store as negative number string or number.
- SECTIONS: Identify generic sections (Assets, Liabilities, Equity) if clearly visible.

Hard constraints:
- Return ONLY valid JSON.
- Preserve exact column headers exactly as printed.
- Preserve exact row labels.
- Capture hierarchy using "parent_label" or "indent_level" when possible.

Return this schema only:
{
  "statement_type": "balance_sheet",
  "currency_skipped": false,
  "detected_currency": "string (LKR or null)",
  "scale_multiplier": "number (e.g. 1.0, 1000.0, 1000000.0)",
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
      "note_reference": "string or null"
    }
  ]
}
"""


class GeminiExtractor:
    """Gemini API client for strict JSON extraction of balance sheets from text chunks."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-2.0-flash",
        model_alias: str = "fast",
        fallback_models: list[str] | None = None,
        temperature: float = 0.0,
        max_retries: int = 2,
    ):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required")
        genai.configure(api_key=api_key)
        self.temperature = temperature
        self.max_retries = max(1, max_retries)
        self.model_candidates = self._build_model_candidates(model_name, model_alias, fallback_models)

    @staticmethod
    def _default_models_for_alias(alias: str) -> list[str]:
        alias_map = {
            "fast": ["gemini-2.0-flash", "gemini-1.5-flash"],
            "balanced": ["gemini-2.0-flash", "gemini-1.5-pro"],
            "quality": ["gemini-1.5-pro", "gemini-2.0-flash"],
        }
        return alias_map.get(alias, alias_map["fast"])

    @staticmethod
    def _dedupe_models(models: list[str]) -> list[str]:
        seen = set()
        ordered = []
        for model in models:
            name = model.strip()
            if not name or name in seen:
                continue
            seen.add(name)
            ordered.append(name)
        return ordered

    def _build_model_candidates(
        self,
        model_name: str,
        model_alias: str,
        fallback_models: list[str] | None,
    ) -> list[str]:
        explicit = [model_name] if model_name else []
        defaults = self._default_models_for_alias(model_alias)
        fallbacks = fallback_models or []
        return self._dedupe_models(explicit + defaults + fallbacks)

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

    def _generate_with_strategy(self, chunk_text: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for model_name in self.model_candidates:
            model = genai.GenerativeModel(model_name)
            for attempt in range(self.max_retries):
                try:
                    response = model.generate_content(
                        [
                            "Here is the text chunk:\n\n" + chunk_text,
                            BALANCE_SHEET_CHUNK_PROMPT,
                        ],
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                            temperature=self.temperature,
                        ),
                    )
                    if not getattr(response, "text", ""):
                        raise ValueError("Empty Gemini response text")
                    return self._parse_response(response.text)
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "Gemini extraction failed model=%s attempt=%s/%s error=%s",
                        model_name,
                        attempt + 1,
                        self.max_retries,
                        exc.__class__.__name__,
                    )

        raise RuntimeError("Gemini extraction failed after model fallback strategy") from last_error

    def extract_chunk(self, chunk_text: str) -> dict[str, Any]:
        if not chunk_text.strip():
            return {"rows": []}
        return self._generate_with_strategy(chunk_text)

