from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract RISK MANAGEMENT data.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "risk_management_overview": "A comprehensive paragraph summarizing the company's overall approach to risk management, frameworks used, and risk appetite.",
  "risk_categories": [
    {
      "label": "Credit Risk",
      "description": "Detailed paragraph describing this risk category and how it affects the company",
      "mitigation_measures": "Paragraph describing how the company mitigates this risk",
      "severity": "High / Medium / Low"
    },
    {
      "label": "Market Risk",
      "description": "Description paragraph",
      "mitigation_measures": "Mitigation paragraph",
      "severity": "High / Medium / Low"
    },
    {
      "label": "Liquidity Risk",
      "description": "Description paragraph",
      "mitigation_measures": "Mitigation paragraph",
      "severity": "High / Medium / Low"
    },
    {
      "label": "Operational Risk",
      "description": "Description paragraph",
      "mitigation_measures": "Mitigation paragraph",
      "severity": "Medium"
    }
  ],
  "risk_metrics": [
    {
      "label": "Risk Metric Name (e.g., Non-Performing Loan Ratio, Value at Risk)",
      "Current Year": "value as string",
      "Prior Year": "value as string"
    }
  ],
  "emerging_risks": "Paragraph about any newly identified or emerging risks mentioned in the report."
}

Include ALL risk categories mentioned: credit, market, liquidity, operational, cyber, climate, regulatory, strategic, reputational.
Use null for unavailable fields.
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
