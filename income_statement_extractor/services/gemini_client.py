import json
import logging
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

INCOME_STATEMENT_CHUNK_PROMPT = """
You are extracting data from a text chunk of an annual report.

Task:
Extract any Statement of Profit or Loss (Income Statement) line items found in this chunk.
If the chunk contains no income statement data, return an empty rows list.
This is a PARTIAL extraction.

Hard constraints:
- Return ONLY valid JSON. No markdown. No commentary.
- Preserve exact column headers exactly as printed (e.g. "2024 (Group)", "2023 (Company)").
- Include all identifiable rows from this chunk.
- Maintain row order found in this chunk.
- Preserve exact row labels; do not rename labels.
- Preserve complete table hierarchy where detectable.
- Values must remain as strings exactly as shown in the table (including commas and parentheses).

Return this schema only:
{
    "statement_type": "income_statement",
    "currency": "string or null",
    "scale": "string or null",
    "rows": [
        {
            "label": "string",
            "values": {
                "<Exact Column Header>": "value as printed or null"
            },
            "section": "string or null",
            "subsection": "string or null",
            "parent_label": "string or null",
            "depth_level": 0,
            "note_reference": "string or null",
            "page_number": 1
        }
    ]
}
"""


class GeminiExtractor:
    """Gemini API client for strict JSON extraction of income statements from text chunks."""

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

    def extract_chunk(self, chunk_text: str) -> dict[str, Any]:
        if not chunk_text.strip():
            return {"rows": []}

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = self.model.generate_content(
                    [
                        "Here is the text chunk:\n\n" + chunk_text,
                        INCOME_STATEMENT_CHUNK_PROMPT,
                    ],
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

        raise RuntimeError("Gemini chunk extraction failed after retry") from last_error
