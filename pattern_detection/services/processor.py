from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Detect FINANCIAL PATTERNS and TRENDS from the data.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "analysis_overview": "A comprehensive paragraph summarizing the key financial patterns, trends, and notable observations from the annual report.",
  "growth_patterns": [
    {
      "label": "Pattern Name (e.g., Revenue Growth Acceleration, Profit Expansion, Market Share Growth)",
      "description": "Paragraph describing the growth pattern observed",
      "trend": "Improving / Declining / Stable",
      "evidence": "Key data points supporting this pattern"
    }
  ],
  "efficiency_patterns": [
    {
      "label": "Pattern Name (e.g., Margin Improvement, Cost Optimization, Operational Efficiency)",
      "description": "Paragraph describing the efficiency pattern",
      "trend": "Improving / Declining / Stable",
      "evidence": "Key data points"
    }
  ],
  "financial_stability_patterns": [
    {
      "label": "Pattern Name (e.g., Debt Management, Liquidity Position, Capital Adequacy)",
      "description": "Paragraph describing the stability pattern",
      "trend": "Improving / Declining / Stable",
      "evidence": "Key data points"
    }
  ],
  "shareholder_value_patterns": [
    {
      "label": "Pattern Name (e.g., Dividend Growth, EPS Trend, Share Price Performance)",
      "description": "Paragraph describing the pattern",
      "trend": "Improving / Declining / Stable",
      "evidence": "Key data points"
    }
  ],
  "risk_signals": [
    {
      "label": "Risk Signal (e.g., Profit Volatility, Cash Flow Stress, Asset Quality Deterioration)",
      "description": "Paragraph describing the risk signal",
      "severity": "High / Medium / Low",
      "recommended_action": "Brief recommendation"
    }
  ],
  "key_insights": "A paragraph summarizing the top 3-5 most important takeaways from the analysis."
}

Analyze ALL available financial data to identify patterns. Use null for unavailable fields.
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
