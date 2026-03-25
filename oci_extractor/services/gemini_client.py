import json
import logging
from typing import Any

import google.generativeai as genai
from common.prompts import SHARED_CURRENCY_SCALE_INSTRUCTION

logger = logging.getLogger(__name__)

OCI_CHUNK_PROMPT = f"""
You are a forensic financial data extractor for Sri Lankan Public Listed Companies (PLCs).

YOUR GOAL:
Extract the **Statement of Other Comprehensive Income** (OCI) line items from the provided text chunk.
This is often presented immediately after the Income Statement (Profit/Loss).
Extract items that are NOT part of Net Profit/Loss, but are part of Total Comprehensive Income.

{SHARED_CURRENCY_SCALE_INSTRUCTION}

SPECIFIC INSTRUCTIONS FOR OCI:
1. **Target Items**:
   - "Other comprehensive income" (header)
   - "Items that will not be reclassified to profit or loss"
   - "Items that may be reclassified to profit or loss"
   - "Gain/(loss) on revaluation of property, plant and equipment"
   - "Actuarial gain/(loss) on defined benefit plans"
   - "Net change in fair value of financial assets"
   - "Exchange differences on translation of foreign operations"
   - "Tax on other comprehensive income"
   - "Total other comprehensive income for the year, net of tax"
   - **"Total comprehensive income for the year"** (This is the final bottom line).

2. **Negative Values**:
   - Items in parentheses `(123)` are negative. Return them as negative numbers (e.g., `-123`).

JSON RESPONSE SCHEMA:
{{
  "statement_type": "oci_statement",
  "detected_currency": "LKR",
  "currency_symbol": "Rs.",
  "scale": "000",
  "scale_multiplier": 1000,
  "is_audited": true,
  "period_end_date": "YYYY-MM-DD",
  "rows": [
    {{
      "label": "exact row label",
      "values": {{
        "2024": 12500,
        "2023": 11200
      }},
      "section": "Items not reclassified|Items reclassified|Total OCI|Total Comprehensive Income|null",
      "parent_label": "parent header if indented",
      "notes": "note number reference"
    }}
  ]
}}
"""


class GeminiExtractor:
    """Gemini API client for strict JSON extraction of OCI statements from text chunks."""

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
                            OCI_CHUNK_PROMPT,
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
