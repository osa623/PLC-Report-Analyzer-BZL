from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class StatementLineItem(BaseModel):
    label: str
    value: float
    period: str | None = None
    currency: str = "BDT"
    source_chunk_id: str | None = None


class FinancialStatements(BaseModel):
    income_statement: list[StatementLineItem] = Field(default_factory=list)
    balance_sheet: list[StatementLineItem] = Field(default_factory=list)
    cashflow: list[StatementLineItem] = Field(default_factory=list)
    equity: list[StatementLineItem] = Field(default_factory=list)


class NarrativeSections(BaseModel):
    notes: list[str] = Field(default_factory=list)
    risk: list[str] = Field(default_factory=list)
    governance: list[str] = Field(default_factory=list)
    esg: list[str] = Field(default_factory=list)
    segment: list[str] = Field(default_factory=list)


class AnalyticsOutputs(BaseModel):
    ratios: dict[str, float] = Field(default_factory=dict)
    kpis: dict[str, float] = Field(default_factory=dict)
    patterns: list[str] = Field(default_factory=list)
    sector_comparison: dict[str, Any] = Field(default_factory=dict)


class CanonicalRawReport(BaseModel):
    report_id: str
    status: str = "extracted"
    schema_version: str = "canonical_raw_v1"
    extracted_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    financial_statements: FinancialStatements = Field(default_factory=FinancialStatements)
    narrative_sections: NarrativeSections = Field(default_factory=NarrativeSections)


class DeterministicChecks(BaseModel):
    balance_sheet_identity: bool
    cash_reconciliation: bool
    net_income_linkage: bool


class ValidationIssue(BaseModel):
    code: str
    message: str
    severity: str = "error"


class CanonicalValidatedReport(BaseModel):
    report_id: str
    status: str = "validated"
    schema_version: str = "canonical_validated_v1"
    validated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    financial_statements: FinancialStatements
    narrative_sections: NarrativeSections
    deterministic_checks: DeterministicChecks
    validation_issues: list[ValidationIssue] = Field(default_factory=list)
    reextraction_required: bool = False
