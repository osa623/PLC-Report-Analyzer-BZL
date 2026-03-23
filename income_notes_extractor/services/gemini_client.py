import json
import logging
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

INCOME_NOTES_CHUNK_PROMPT = """
You are extracting data from a text chunk of an annual report.

Task:
Extract ONLY income-related Notes to Accounts content found in this chunk.
If there are no relevant income notes in the chunk, return an empty notes list.
This is a PARTIAL extraction.

Include notes related to:
- Revenue
- Cost of Sales
- Operating Expenses
- Other Income

Hard constraints:
- Return ONLY valid JSON. No markdown. No commentary.
- Extract ONLY income-related notes; ignore unrelated notes.
- Preserve exact note_number and note_title.
- Preserve exact column headers exactly as printed (e.g. "2024 (Group)", "2023 (Company)").
- Include all rows in each extracted note, including subtotals and totals.
- Maintain row order within each note.
- Preserve exact row labels; do not rename.
- Capture hierarchy with indent_level and parent_label if possible.
- Merge multi-page continuation of the same note into a single note entry.
- Values must remain as strings exactly as shown (commas and parentheses included).

Return this schema only:
{
  "statement_type": "income_notes",
  "currency": "string or null",
  "scale": "string or null",
  "notes": [
    {
      "note_number": "string",
      "note_title": "string",
      "rows": [
        {
          "label": "string",
          "values": {
            "<Exact Column Header>": "value as printed or null"
          },
          "section": "string or null",
          "subsection": "string or null",
          "parent_label": "string or null",
          "indent_level": 0,
          "note_reference": "string or null",
          "page_number": 1
        }
      ]
    }
  ]
}
"""


class GeminiExtractor:
    """Gemini API client with model alias/fallback and retry strategy."""

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

    def _generate_with_strategy(self, chunk_text: str, prompt: str) -> dict[str, Any]:
        last_error: Exception | None = None
        for model_name in self.model_candidates:
            model = genai.GenerativeModel(model_name)
            for attempt in range(self.max_retries):
                try:
                    response = model.generate_content(
                        [
                            "Here is the text chunk:\n\n" + chunk_text,
                            prompt,
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
            return {"notes": []}
        return self._generate_with_strategy(chunk_text, INCOME_NOTES_CHUNK_PROMPT)