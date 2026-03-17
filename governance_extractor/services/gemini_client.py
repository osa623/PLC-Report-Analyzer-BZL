import json
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

GOVERNANCE_PROMPT = """
You are extracting corporate governance disclosures from an annual report PDF.

Task:
Extract ALL governance-related disclosures.

Scope:
- Board of Directors
- Committees (audit, risk, nomination, remuneration, and other committees)
- Executive leadership
- Governance policies and compliance statements

Hard constraints:
- Return ONLY valid JSON. No markdown. No commentary.
- No summarization. Preserve names, roles, and governance policy text exactly.
- Include all governance entities found in the report.
- If a field is missing, return null or empty list as appropriate.

Return this schema only:
{
  "board_members": [
    {
      "name": "string",
      "role": "string or null",
      "type": "independent | executive | non-executive | other | null"
    }
  ],
  "committees": [
    {
      "name": "string",
      "members": ["member name"],
      "role": "string or null"
    }
  ],
  "executive_leadership": [
    {
      "name": "string",
      "role": "string or null",
      "type": "string or null"
    }
  ],
  "governance_policies": [
    {
      "name": "string",
      "text": "raw policy text"
    }
  ]
}
"""


class GeminiExtractor:
    """Gemini API client for strict governance JSON extraction."""

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

    def extract_governance(self, file_path: str) -> dict[str, Any]:
        if not Path(file_path).exists():
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                uploaded_file = genai.upload_file(file_path, mime_type="application/pdf")
                response = self.model.generate_content(
                    [uploaded_file, GOVERNANCE_PROMPT],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
                return self._parse_response(response.text)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini governance extraction attempt %s failed: %s",
                    attempt + 1,
                    exc.__class__.__name__,
                )

        raise RuntimeError("Gemini governance extraction failed after retry") from last_error
