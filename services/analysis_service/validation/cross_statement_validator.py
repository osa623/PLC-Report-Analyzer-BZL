from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, ValidationIssue


def validate_cross_statement(canonical: CanonicalRawReport) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if len(canonical.financial_statements.income_statement) < 1 and len(canonical.financial_statements.cashflow) > 0:
        issues.append(ValidationIssue(code="CROSS_STMT_MISSING_INCOME", message="Cashflow exists without income statement"))
    return issues
