from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract BUSINESS SEGMENT performance data.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "reporting_period": "e.g., 2015/2016",
  "currency": "e.g., Rs. '000",
  "segment_overview": "Brief paragraph describing the company's business segments and their performance during the reporting period.",
  "segment_performance": [
    {
      "label": "Segment Name (e.g., Retail Banking / Transportation / Leisure)",
      "Revenue": "value as string",
      "Profit": "value as string",
      "Assets": "value as string",
      "Revenue Prior Year": "value as string",
      "Profit Prior Year": "value as string"
    }
  ],
  "segment_contribution": [
    {
      "label": "Segment Name",
      "Revenue Contribution %": "e.g., 45.2%",
      "Profit Contribution %": "e.g., 38.5%"
    }
  ],
  "segment_growth": [
    {
      "label": "Segment Name",
      "Revenue Growth %": "e.g., 12.5%",
      "Profit Growth %": "e.g., 15.3%"
    }
  ]
}

Extract ALL business segments reported. Use null for unavailable data.
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
