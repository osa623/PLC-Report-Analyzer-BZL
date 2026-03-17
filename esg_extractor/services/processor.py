from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract ESG (Environmental, Social, and Governance) and SUSTAINABILITY data.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "sustainability_overview": "A comprehensive paragraph summarizing the company's sustainability strategy, commitments, and frameworks followed (GRI, SDGs, etc.).",
  "environmental_metrics": [
    {
      "label": "Metric Name (e.g., Carbon Emissions, Energy Consumption, Water Usage)",
      "Unit": "e.g., tCO2e, kWh, m³",
      "Current Year": "value as string",
      "Prior Year": "value as string",
      "Target": "target value if mentioned"
    }
  ],
  "social_metrics": [
    {
      "label": "Metric Name (e.g., Total Employees, Female Employees, Training Hours)",
      "Unit": "e.g., Count, Hours, %",
      "Current Year": "value as string",
      "Prior Year": "value as string"
    }
  ],
  "governance_metrics": [
    {
      "label": "Metric Name (e.g., Board Independence %, Ethics Violations)",
      "Current Year": "value as string",
      "Prior Year": "value as string"
    }
  ],
  "community_investments": "Paragraph about CSR activities, community development programs, and social investments.",
  "sdg_alignment": [
    {
      "label": "SDG Number and Name (e.g., SDG 4: Quality Education)",
      "Initiatives": "Brief description of relevant initiatives"
    }
  ],
  "awards_and_certifications": "Paragraph about sustainability-related awards, certifications, or recognitions received."
}

Extract ALL ESG data mentioned. Use null for unavailable fields.
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
