from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalRawReport, DeterministicChecks, ValidationIssue


EPSILON = 1e-6
REL_TOL = 0.03


def _index(items: list) -> dict[str, float]:
    return {item.label.lower(): float(item.value) for item in items if item.value is not None}


def validate_accounting(canonical: CanonicalRawReport, with_checks: bool = False):
    bs = _index(canonical.financial_statements.balance_sheet)
    cf = _index(canonical.financial_statements.cashflow)
    eq = _index(canonical.financial_statements.equity)
    inc = _index(canonical.financial_statements.income_statement)

    assets = bs.get("total assets")
    liabilities = bs.get("total liabilities")
    equity = bs.get("total equity")
    opening_cash = cf.get("opening cash")
    net_cash_flow = cf.get("net cash flow")
    closing_cash = cf.get("closing cash")
    ni_income = inc.get("net income")
    ni_cashflow = cf.get("net income")
    retained_change = eq.get("change in retained earnings")

    def rel_close(a: float | None, b: float | None, tol: float = REL_TOL) -> bool:
        if a is None or b is None:
            return False
        denom = max(abs(float(a)), abs(float(b)), 1.0)
        return abs(float(a) - float(b)) / denom <= tol

    has_bs = all(v is not None for v in [assets, liabilities, equity])
    has_cash = all(v is not None for v in [opening_cash, net_cash_flow, closing_cash])
    has_ni = all(v is not None for v in [ni_income, ni_cashflow, retained_change])

    checks = DeterministicChecks(
        balance_sheet_identity=has_bs and rel_close(float(assets), float(liabilities) + float(equity)),
        cash_reconciliation=has_cash and rel_close(float(opening_cash) + float(net_cash_flow), float(closing_cash)),
        net_income_linkage=has_ni and rel_close(float(ni_income), float(ni_cashflow)) and rel_close(float(ni_income), float(retained_change)),
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
