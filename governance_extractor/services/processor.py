from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract CORPORATE GOVERNANCE data.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "governance_overview": "A paragraph summarizing the company's corporate governance framework, practices, and compliance with applicable codes.",
  "board_of_directors": [
    {
      "label": "Director Name",
      "Designation": "e.g., Chairman / Managing Director / Independent Non-Executive Director",
      "Executive/Non-Executive": "Executive or Non-Executive",
      "Independent": "Yes or No",
      "Appointed Date": "date if available",
      "Committees": "e.g., Audit, Remuneration"
    }
  ],
  "board_composition": {
    "total_directors": "number",
    "executive_directors": "number",
    "non_executive_directors": "number",
    "independent_directors": "number"
  },
  "board_committees": [
    {
      "label": "Committee Name (e.g., Audit Committee)",
      "Chairman": "Name of committee chair",
      "Members": "Comma-separated names",
      "Meetings Held": "number of meetings"
    }
  ],
  "director_remuneration": [
    {
      "label": "Director Name",
      "Remuneration": "value as string",
      "Other Benefits": "value as string"
    }
  ],
  "compliance_statement": "Paragraph about compliance with corporate governance codes and regulations."
}

Extract ALL governance information. Use null for unavailable fields.
Return ONLY the JSON object.
"""


class ProcessingStrategy(ABC):
    @abstractmethod
    def run(self, report_id: str, file_path: str) -> dict:
        raise NotImplementedError


class GeminiProcessingStrategy(ProcessingStrategy):
    def __init__(self, repository: ReportRepository) -> None:
        self.repository = repository
        settings = get_settings()
        self.extractor = GeminiExtractor(settings.gemini_api_key)

    def run(self, report_id: str, file_path: str) -> dict:
        extracted = self.extractor.extract_from_pdf(file_path, EXTRACTION_PROMPT)
        payload = {
            "report_id": report_id,
            "file_path": file_path,
            **extracted,
        }
        self.repository.persist_result(report_id, payload)
        return payload


class ProcessingService:
    def __init__(self, strategy: ProcessingStrategy) -> None:
        self.strategy = strategy

    def process(self, report_id: str, file_path: str) -> dict:
        return self.strategy.run(report_id, file_path)


class ProcessingServiceFactory:
    @staticmethod
    def create(repository: ReportRepository) -> ProcessingService:
        return ProcessingService(GeminiProcessingStrategy(repository))
