from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalValidatedReport


def compute_kpis(validated: CanonicalValidatedReport) -> dict[str, float]:
    inc = {i.label.lower(): i.value for i in validated.financial_statements.income_statement if i.value is not None}
    cf = {i.label.lower(): i.value for i in validated.financial_statements.cashflow if i.value is not None}
    return {
        "net_income": float(inc.get("net income", 0.0)),
        "net_cash_flow": float(cf.get("net cash flow", 0.0)),
    }
