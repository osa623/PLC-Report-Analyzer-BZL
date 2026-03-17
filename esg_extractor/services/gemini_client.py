import json
import logging
from pathlib import Path
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

ESG_PROMPT = """
You are extracting ESG disclosures from an annual report PDF.

Task:
Extract ALL Environmental, Social, and Governance disclosures from both tables and narrative sections.

Scope:
- Environmental: emissions (CO2, Scope 1/2/3), energy consumption, sustainability initiatives
- Social: employee metrics, diversity data, community initiatives
- Governance: board structure summary, compliance statements

Hard constraints:
- Return ONLY valid JSON. No markdown. No commentary.
- No summarization. Preserve narrative text exactly as disclosed.
- Extract ALL ESG-related content you can find; do not omit relevant rows/items.
- Keep numeric values as displayed strings in raw output.
- Preserve year keys as they appear.
- If category is unclear, use \"other\".

Return this schema only:
{
  "categories": [
    {
      "category": "environmental | social | governance | other",
      "items": [
        {
          "label": "string",
          "values": {
            "2024": "1000 tons"
          },
          "type": "metric"
        },
        {
          "label": "string",
          "text": "raw narrative text",
          "type": "narrative"
        }
      ]
    }
  ]
}
"""


class GeminiExtractor:
    """Gemini API client for strict JSON ESG extraction."""

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

    def extract_esg(self, file_path: str) -> dict[str, Any]:
        if not Path(file_path).exists():
            raise FileNotFoundError(f"PDF file not found: {file_path}")

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                uploaded_file = genai.upload_file(file_path, mime_type="application/pdf")
                response = self.model.generate_content(
                    [uploaded_file, ESG_PROMPT],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
                return self._parse_response(response.text)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini ESG extraction attempt %s failed: %s",
                    attempt + 1,
                    exc.__class__.__name__,
                )

        raise RuntimeError("Gemini ESG extraction failed after retry") from last_error
