import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)


GLOBAL_EXTRACTION_RULES = """
GLOBAL EXTRACTION RULES (apply in addition to task-specific instructions):
- Use Gemini OCR understanding of the PDF content, including scanned/table regions.
- Return one valid JSON object only.
- Keep the task-specific JSON schema requested by the prompt as the primary output.
- For narrative content, return plain paragraph strings (not fragmented words).
- For table content, return an array of row objects where each row uses:
    - "label" for the row name/description
    - exact document column headers as keys (e.g., "2016 (Bank)")
    - values as strings preserving commas, parentheses, and formatting
    - null for missing table cells
- Do not add markdown fences or prose outside JSON.
"""


class GeminiExtractor:
    """Shared Gemini API client for PDF data extraction."""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.0-flash")

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

    def extract_from_pdf(self, file_path: str, prompt: str) -> dict:
        """Upload a PDF to Gemini and extract structured data."""
        try:
            uploaded_file = genai.upload_file(file_path, mime_type="application/pdf")
            composed_prompt = f"{prompt.strip()}\n\n{GLOBAL_EXTRACTION_RULES.strip()}"
            response = self.model.generate_content(
                [uploaded_file, composed_prompt],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            text = self._clean_json_text(response.text)
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return json.loads(self._extract_json_object(text))
        except json.JSONDecodeError as e:
            logger.error("Gemini returned non-JSON: %s", e)
            return {"error": "Failed to parse Gemini response", "raw": response.text[:500]}
        except Exception as e:
            logger.error("Gemini extraction failed: %s", e)
            return {"error": str(e)}
