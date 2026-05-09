from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field


FINANCIAL_STATEMENT_SCHEMA_VERSION = "financial_statement_model_v1"
ANALYSIS_RESULT_SCHEMA_VERSION = "analysis_result_model_v1"
DASHBOARD_DTO_SCHEMA_VERSION = "dashboard_dto_v1"

EXTRACTION_CALCULATION_VERSION = "extraction_normalization_v1"
ANALYSIS_CALCULATION_VERSION = "analysis_calculation_engine_v1"
REPORTING_CALCULATION_VERSION = "reporting_presentation_v1"


def _stable_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str)


def deterministic_hash_id(prefix: str, payload: Any) -> str:
    digest = hashlib.sha256(_stable_json(payload).encode("utf-8")).hexdigest()
    return f"{prefix}_{digest[:24]}"


def deterministic_timestamp(seed: str) -> str:
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    # Stable pseudo-time anchored to 2024-01-01T00:00:00Z.
    anchor = datetime(2024, 1, 1, tzinfo=UTC)
    offset_seconds = int(digest[:10], 16) % (10 * 365 * 24 * 60 * 60)
    ts = anchor + timedelta(seconds=offset_seconds)
    return ts.replace(microsecond=0).isoformat().replace("+00:00", "Z")


class ContractEnvelope(BaseModel):
    dataset_id: str
    schema_version: str
    calculation_version: str
    timestamp: str


class IncomeStatementModel(BaseModel):
    revenue: float
    cost_of_sales: float
    gross_profit: float
    operating_profit: float
    net_profit: float


class BalanceSheetModel(BaseModel):
    total_assets: float
    total_liabilities: float
    equity: float
    current_assets: float
    current_liabilities: float
    inventory: float
    cash: float
    total_debt: float


class CashFlowModel(BaseModel):
    operating_cash_flow: float
    investing_cash_flow: float
    financing_cash_flow: float


class FinancialMetadataModel(BaseModel):
    company_name: str = "unknown"
    fiscal_year: int
    fiscal_period: str = "annual"
    currency: str = "LKR"
    shares_outstanding: float | None = None


class ExtractionAuditEvent(BaseModel):
    stage: str
    status: str
    details: dict[str, Any] = Field(default_factory=dict)


class FinancialStatementModel(BaseModel):
    envelope: ContractEnvelope
    income_statement: IncomeStatementModel
    balance_sheet: BalanceSheetModel
    cash_flow: CashFlowModel
    metadata: FinancialMetadataModel
    audit_log: list[ExtractionAuditEvent] = Field(default_factory=list)
    value_trace: dict[str, Any] = Field(default_factory=dict)


class AnalysisResultModel(BaseModel):
    envelope: ContractEnvelope
    metrics: dict[str, Any] = Field(default_factory=dict)
    trends: dict[str, Any] = Field(default_factory=dict)
    risk_flags: list[str] = Field(default_factory=list)
    financial_health_scores: dict[str, float] = Field(default_factory=dict)
    data_quality_score: float
    calculation_trace: dict[str, Any] = Field(default_factory=dict)


class DashboardDTO(BaseModel):
    envelope: ContractEnvelope
    top_summary_cards: dict[str, Any] = Field(default_factory=dict)
    chart_datasets: dict[str, Any] = Field(default_factory=dict)
    table_data: dict[str, Any] = Field(default_factory=dict)
    presentation: dict[str, Any] = Field(default_factory=dict)


def _relative_gap(left: float, right: float) -> float:
    denom = max(abs(float(left)), abs(float(right)), 1.0)
    return abs(float(left) - float(right)) / denom


def validate_financial_statement_model(model: FinancialStatementModel, tolerance: float = 0.05) -> list[str]:
    """Validate a FinancialStatementModel. Returns severity-prefixed issues.

    Severity prefixes:
      - "error:..."   → fundamentally broken data
      - "warning:..." → imprecision but usable
      - "info:..."    → missing optional field, defaulted
    """
    issues: list[str] = []

    assets = float(model.balance_sheet.total_assets)
    liabilities = float(model.balance_sheet.total_liabilities)
    equity = float(model.balance_sheet.equity)

    # Only check balance sheet identity when all three values are non-zero (real data).
    if assets > 0.0 and (liabilities > 0.0 or equity > 0.0):
        identity_lhs = assets
        identity_rhs = liabilities + equity
        gap = _relative_gap(identity_lhs, identity_rhs)
        if gap > tolerance:
            issues.append("warning:balance_sheet_identity_outside_tolerance")
        elif gap > 0.01:
            issues.append("info:balance_sheet_identity_minor_gap")

    revenue = float(model.income_statement.revenue)
    cost_of_sales = float(model.income_statement.cost_of_sales)
    gross_profit = float(model.income_statement.gross_profit)

    # Skip gross profit identity when cost_of_sales or gross_profit is 0.0
    # (indicates missing data, not a genuine mismatch).
    if cost_of_sales != 0.0 and gross_profit != 0.0 and revenue > 0.0:
        gross_profit_expected = revenue - cost_of_sales
        gap = _relative_gap(gross_profit, gross_profit_expected)
        if gap > tolerance:
            issues.append("warning:gross_profit_identity_outside_tolerance")
        elif gap > 0.01:
            issues.append("info:gross_profit_identity_minor_gap")

    # Info-level notices for missing optional fields.
    if model.balance_sheet.inventory == 0.0:
        issues.append("info:missing_inventory")
    if model.balance_sheet.cash == 0.0:
        issues.append("info:missing_cash")
    if model.balance_sheet.total_debt == 0.0:
        issues.append("info:missing_total_debt")
    if model.cash_flow.operating_cash_flow == 0.0:
        issues.append("info:missing_operating_cash_flow")
    if model.metadata.shares_outstanding is None:
        issues.append("info:missing_shares_outstanding")

    return issues


def build_envelope(dataset_id: str, schema_version: str, calculation_version: str) -> ContractEnvelope:
    seed = f"{dataset_id}|{schema_version}|{calculation_version}"
    return ContractEnvelope(
        dataset_id=dataset_id,
        schema_version=schema_version,
        calculation_version=calculation_version,
        timestamp=deterministic_timestamp(seed),
    )
