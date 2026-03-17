from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Extract SECTOR-SPECIFIC KPIs (Key Performance Indicators).

First determine the company's sector (Banking, Insurance, Retail, Manufacturing, Conglomerate, etc.)
then extract sector-relevant KPIs.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "sector": "Detected sector",
  "reporting_period": "e.g., 2015/2016",
  "kpi_overview": "A paragraph summarizing the company's operational performance and key metrics during the reporting period.",
  "operational_kpis": [
    {
      "label": "KPI Name",
      "Unit": "e.g., %, Ratio, Count, Rs. '000",
      "Current Year": "value as string",
      "Prior Year": "value as string",
      "Change %": "percentage change"
    }
  ],
  "banking_kpis": [
    {
      "label": "KPI Name (e.g., Loans Portfolio, Deposit Base, NPL Ratio, Capital Adequacy Ratio, Tier 1 Capital Ratio, Net Interest Margin)",
      "Current Year": "value as string",
      "Prior Year": "value as string"
    }
  ],
  "retail_kpis": [
    {
      "label": "KPI Name (e.g., Store Count, Revenue Per Square Foot, Inventory Turnover)",
      "Current Year": "value as string",
      "Prior Year": "value as string"
    }
  ],
  "ten_year_summary": [
    {
      "label": "Metric Name (e.g., Revenue, Net Profit, Total Assets, EPS, DPS)",
      "2016": "value",
      "2015": "value",
      "2014": "value",
      "2013": "value",
      "2012": "value"
    }
  ]
}

Include ONLY the KPI arrays relevant to the detected sector. Use empty arrays for non-applicable sections.
Use null for unavailable data.
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
