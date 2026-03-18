from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract the following corporate metadata as a JSON object:

{
  "company_name": "Full legal name of the company",
  "cse_ticker": "CSE ticker symbol if found",
  "sector": "Industry sector (e.g., Banking, Retail, Manufacturing)",
  "reporting_period": "e.g., 2015/2016 or Year ended 31 March 2016",
  "financial_year_end": "e.g., 31 March 2016",
  "reporting_scope": "Group or Company or Both",
  "subsidiaries": ["List of subsidiary names if mentioned"],
  "auditor": "Name of the external auditor",
  "reporting_frameworks": ["e.g., IFRS, SLFRS, GRI, SASB"],
  "chairman": "Name of the chairman if found",
  "ceo": "Name of the CEO/Managing Director if found",
  "registered_address": "Registered office address",
  "website": "Company website if mentioned",
  "number_of_employees": "Total employee count if mentioned",
  "date_of_incorporation": "Date of incorporation if mentioned"
}

Extract ALL available fields. Use null for fields not found in the document.
Return ONLY the JSON object, no additional text.
"""


class ProcessingStrategy(ABC):
    @abstractmethod
    def run(self, report_id: str, file_path: str) -> dict:
        raise NotImplementedError

class ProcessingService:
    """Compatibility wrapper for callers still importing ProcessingService."""

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
            "corporate_metadata": extracted,
        }
        write_ok = self.repository.persist_result(report_id, payload)
        payload["status"] = "SUCCESS" if write_ok else "failed"
        return payload


class ProcessingService:
    def __init__(self, strategy: ProcessingStrategy) -> None:
        self.strategy = strategy

    def process(self, report_id: str, file_path: str) -> str:
        return self.delegate.process(report_id, file_path)


class ProcessingServiceFactory:
    @staticmethod
    def create(repository: ReportRepository) -> ProcessingService:
        return ProcessingService(GeminiProcessingStrategy(repository))
