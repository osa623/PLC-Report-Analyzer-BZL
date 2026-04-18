from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, ValidationIssue


def validate_schema(canonical: CanonicalRawReport) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not canonical.financial_statements.income_statement:
        issues.append(ValidationIssue(code="MISSING_INCOME_STATEMENT", message="Income statement is empty"))
    if not canonical.financial_statements.balance_sheet:
        issues.append(ValidationIssue(code="MISSING_BALANCE_SHEET", message="Balance sheet is empty"))
    if not canonical.financial_statements.cashflow:
        issues.append(ValidationIssue(code="MISSING_CASHFLOW", message="Cashflow statement is empty"))
    return issues
