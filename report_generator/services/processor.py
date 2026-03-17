from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Generate a comprehensive ANALYTICAL REPORT summarizing all key aspects.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "report_title": "Analytical Report — [Company Name] — [Year]",
  "executive_summary": "A comprehensive executive summary paragraph covering the company's overall performance, key achievements, challenges, and outlook for the reporting period.",
  "company_overview": "Paragraph with company background, sector, history, and scope of operations.",
  "financial_performance_analysis": "Detailed paragraph analyzing revenue, profitability, margins, and year-over-year comparisons.",
  "balance_sheet_analysis": "Paragraph analyzing asset quality, liability management, capital structure, and balance sheet strength.",
  "cash_flow_analysis": "Paragraph analyzing operating, investing, and financing cash flows and their implications.",
  "key_financial_highlights": [
    {
      "label": "Metric",
      "Current Year": "value",
      "Prior Year": "value",
      "Change": "value"
    }
  ],
  "segment_performance": "Paragraph about business segment contributions and performance.",
  "market_valuation": "Paragraph about share price performance, EPS, PE ratio, and market sentiment.",
  "strategic_direction": "Paragraph about strategic initiatives, future plans, and competitive positioning.",
  "risk_assessment": "Paragraph summarizing key risks and their management.",
  "esg_performance": "Paragraph about sustainability activities and ESG performance.",
  "governance_quality": "Paragraph evaluating corporate governance practices.",
  "strengths": ["Key strength 1", "Key strength 2", "Key strength 3"],
  "weaknesses": ["Key weakness 1", "Key weakness 2"],
  "opportunities": ["Key opportunity 1", "Key opportunity 2"],
  "threats": ["Key threat 1", "Key threat 2"],
  "final_investment_insight": "A concluding paragraph providing an investment-oriented assessment and outlook for the company."
}

Generate DETAILED PARAGRAPHS (not bullet points) for text fields.
Use data from the actual report to back up all analysis.
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
