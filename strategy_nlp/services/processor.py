from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract STRATEGY AND BUSINESS MODEL information.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "vision": "The company's vision statement as a complete paragraph. Use null if not found.",
  "mission": "The company's mission statement as a complete paragraph. Use null if not found.",
  "core_values": "A paragraph describing the company's core values, or a list of values.",
  "strategic_pillars": [
    {
      "label": "Strategic Pillar Name (e.g., Digital Transformation, Customer Centricity)",
      "description": "Detailed paragraph explaining this strategic pillar and its initiatives"
    }
  ],
  "business_model_description": "A comprehensive paragraph or multiple paragraphs describing how the company creates, delivers, and captures value.",
  "value_creation_framework": "Paragraph describing the integrated value creation model if present in the report.",
  "key_strategic_initiatives": [
    {
      "label": "Initiative Name",
      "description": "Paragraph describing the initiative, its objectives, and progress",
      "status": "Completed / In Progress / Planned"
    }
  ],
  "competitive_advantages": "Paragraph describing the company's key competitive advantages and market positioning.",
  "growth_strategy": "Paragraph describing the company's growth strategy including expansion plans, new markets, or product development.",
  "capital_allocation_priorities": [
    {
      "label": "Capital Type (e.g., Financial Capital, Human Capital, Digital Capital)",
      "investments": "Description of investments and initiatives in this capital area",
      "strategic_focus": "How this capital supports the overall strategy"
    }
  ]
}

Extract text-heavy strategy content as FULL PARAGRAPHS, not bullet points or fragments.
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
