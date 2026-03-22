from typing import Any, Literal

from pydantic import BaseModel, Field


class CompanyInfo(BaseModel):
    symbol: str = ""
    name: str = ""
    sector: str = ""


class ComparativeRequest(BaseModel):
    batch_id: str
    report_ids: list[str]
    company: CompanyInfo = Field(default_factory=CompanyInfo)


class BatchResultRequest(BaseModel):
    batch_id: str


class InvestmentSignal(BaseModel):
    category: str
    signal: Literal["BULLISH", "BEARISH", "NEUTRAL"]
    strength: float = 0.0
    description: str = ""
    supporting_data: dict[str, Any] = Field(default_factory=dict)


class YearMetric(BaseModel):
    year: int
    value: float


class MetricTrend(BaseModel):
    metric_name: str
    display_name: str
    values: list[YearMetric] = Field(default_factory=list)
    cagr: float | None = None
    latest_yoy_change: float | None = None


class GrowthAnalysis(BaseModel):
    revenue_growth_rates: list[YearMetric] = Field(default_factory=list)
    profit_growth_rates: list[YearMetric] = Field(default_factory=list)
    asset_growth_rates: list[YearMetric] = Field(default_factory=list)
    margin_trends: list[YearMetric] = Field(default_factory=list)


class DuPontDecomposition(BaseModel):
    year: int
    net_margin: float | None = None
    asset_turnover: float | None = None
    equity_multiplier: float | None = None
    roe: float | None = None


class FinancialHealthScore(BaseModel):
    overall_score: float = 0.0
    profitability_score: float = 0.0
    liquidity_score: float = 0.0
    growth_score: float = 0.0
    efficiency_score: float = 0.0
    stability_score: float = 0.0


class CashflowBreakdown(BaseModel):
    year: int
    operating: float | None = None
    investing: float | None = None
    financing: float | None = None
    net: float | None = None


class ComparativeResult(BaseModel):
    batch_id: str
    company: CompanyInfo = Field(default_factory=CompanyInfo)
    status: str = "completed"
    metric_trends: list[MetricTrend] = Field(default_factory=list)
    growth_analysis: GrowthAnalysis = Field(default_factory=GrowthAnalysis)
    investment_signals: list[InvestmentSignal] = Field(default_factory=list)
    dupont_analysis: list[DuPontDecomposition] = Field(default_factory=list)
    financial_health: FinancialHealthScore = Field(default_factory=FinancialHealthScore)
    cashflow_breakdown: list[CashflowBreakdown] = Field(default_factory=list)
    ratio_comparison: dict[str, list[YearMetric]] = Field(default_factory=dict)
    risk_heatmap: dict[str, dict[int, float]] = Field(default_factory=dict)
    years_analyzed: list[int] = Field(default_factory=list)
    report_ids: list[str] = Field(default_factory=list)


class ComparativeResponse(BaseModel):
    batch_id: str
    status: str
