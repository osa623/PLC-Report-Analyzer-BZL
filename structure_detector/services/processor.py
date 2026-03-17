from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Detect and classify the major sections present in this document.

Return a JSON object with this structure:
{
  "document_title": "Title of the annual report",
  "total_pages": number_of_pages_if_detectable,
  "sections": [
    {
      "section_name": "e.g., Chairman's Statement",
      "section_type": "one of: financial_statements, management_discussion, governance, risk_management, esg_sustainability, strategy, shareholder_information, segment_analysis, notes_to_accounts, auditor_report, corporate_information, other",
      "estimated_page_range": "e.g., 45-52",
      "contains_tables": true_or_false,
      "contains_financial_data": true_or_false
    }
  ],
  "detected_financial_statements": [
    "income_statement",
    "balance_sheet",
    "cash_flow_statement",
    "statement_of_changes_in_equity"
  ],
  "reporting_years": ["2016", "2015"],
  "is_consolidated": true_or_false,
  "language": "English or Sinhala or Tamil or Mixed"
}

Identify ALL major sections. Return ONLY the JSON object.
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
            "structure": extracted,
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
