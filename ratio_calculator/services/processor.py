from abc import ABC, abstractmethod

from core.config import get_settings
from repositories.report_repository import ReportRepository
from services.gemini_client import GeminiExtractor

EXTRACTION_PROMPT = """
You are analyzing a Sri Lankan company annual report PDF.
Calculate and extract financial ratios from the financial statements.

Return a JSON object with this structure:
{
  "company_name": "Name of the company",
  "reporting_period": "e.g., 2015/2016",
  "currency": "e.g., Rs. '000",
  "profitability_ratios": [
    {"label": "Gross Profit Margin", "formula": "Gross Profit / Revenue", "value": "25.5%", "prior_year_value": "24.2%"},
    {"label": "Operating Profit Margin", "formula": "Operating Profit / Revenue", "value": "18.3%", "prior_year_value": "17.1%"},
    {"label": "Net Profit Margin", "formula": "Net Profit / Revenue", "value": "12.5%", "prior_year_value": "11.8%"},
    {"label": "Return on Equity (ROE)", "formula": "Net Profit / Total Equity", "value": "15.2%", "prior_year_value": "14.5%"},
    {"label": "Return on Assets (ROA)", "formula": "Net Profit / Total Assets", "value": "8.3%", "prior_year_value": "7.9%"},
    {"label": "EBITDA Margin", "formula": "EBITDA / Revenue", "value": "22.1%", "prior_year_value": "21.0%"}
  ],
  "liquidity_ratios": [
    {"label": "Current Ratio", "formula": "Current Assets / Current Liabilities", "value": "1.52", "prior_year_value": "1.48"},
    {"label": "Quick Ratio", "formula": "(Current Assets - Inventories) / Current Liabilities", "value": "1.12", "prior_year_value": "1.08"}
  ],
  "leverage_ratios": [
    {"label": "Debt to Equity Ratio", "formula": "Total Debt / Total Equity", "value": "0.85", "prior_year_value": "0.92"},
    {"label": "Interest Coverage Ratio", "formula": "Operating Profit / Finance Cost", "value": "4.5x", "prior_year_value": "4.2x"},
    {"label": "Equity Ratio", "formula": "Total Equity / Total Assets", "value": "45.2%", "prior_year_value": "43.8%"}
  ],
  "efficiency_ratios": [
    {"label": "Asset Turnover", "formula": "Revenue / Total Assets", "value": "0.65", "prior_year_value": "0.62"},
    {"label": "Inventory Turnover", "formula": "Cost of Sales / Average Inventory", "value": "8.2x", "prior_year_value": "7.8x"}
  ],
  "market_ratios": [
    {"label": "Earnings Per Share (EPS)", "value": "15.23", "prior_year_value": "14.05"},
    {"label": "Price Earnings Ratio (PE)", "value": "12.5x", "prior_year_value": "11.8x"},
    {"label": "Dividend Per Share", "value": "5.00", "prior_year_value": "4.50"},
    {"label": "Dividend Payout Ratio", "value": "32.8%", "prior_year_value": "32.0%"},
    {"label": "Net Asset Value Per Share", "value": "102.50", "prior_year_value": "98.30"}
  ]
}

Calculate ratios from the actual data in the report. Use null for ratios that cannot be computed.
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
