from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, DeterministicChecks, ValidationIssue


EPSILON = 1e-6


def _index(items: list) -> dict[str, float]:
    return {item.label.lower(): float(item.value) for item in items}


def validate_accounting(canonical: CanonicalRawReport, with_checks: bool = False):
    bs = _index(canonical.financial_statements.balance_sheet)
    cf = _index(canonical.financial_statements.cashflow)
    eq = _index(canonical.financial_statements.equity)
    inc = _index(canonical.financial_statements.income_statement)

    assets = bs.get("total assets", 0.0)
    liabilities = bs.get("total liabilities", 0.0)
    equity = bs.get("total equity", 0.0)
    opening_cash = cf.get("opening cash", 0.0)
    net_cash_flow = cf.get("net cash flow", 0.0)
    closing_cash = cf.get("closing cash", 0.0)
    ni_income = inc.get("net income", 0.0)
    ni_cashflow = cf.get("net income", 0.0)
    retained_change = eq.get("change in retained earnings", 0.0)

    checks = DeterministicChecks(
        balance_sheet_identity=abs(assets - (liabilities + equity)) <= EPSILON,
        cash_reconciliation=abs((opening_cash + net_cash_flow) - closing_cash) <= EPSILON,
        net_income_linkage=abs(ni_income - ni_cashflow) <= EPSILON and abs(ni_income - retained_change) <= EPSILON,
    )

    issues: list[ValidationIssue] = []
    if not checks.balance_sheet_identity:
        issues.append(ValidationIssue(code="BALANCE_SHEET_IDENTITY_FAILED", message="Assets != Liabilities + Equity"))
    if not checks.cash_reconciliation:
        issues.append(ValidationIssue(code="CASH_RECONCILIATION_FAILED", message="OpeningCash + NetCashFlow != ClosingCash"))
    if not checks.net_income_linkage:
        issues.append(ValidationIssue(code="NET_INCOME_LINKAGE_FAILED", message="Net income mismatch across statements"))

    if with_checks:
        return checks, issues
    return issues
