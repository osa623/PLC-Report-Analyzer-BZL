from __future__ import annotations

from platform_core.contracts.canonical_dataset import CanonicalValidatedReport


def compute_ratios(validated: CanonicalValidatedReport) -> dict[str, float]:
    bs = {i.label.lower(): i.value for i in validated.financial_statements.balance_sheet}
    inc = {i.label.lower(): i.value for i in validated.financial_statements.income_statement}

    current_assets = bs.get("current assets", bs.get("total assets", 0.0))
    current_liabilities = bs.get("current liabilities", bs.get("total liabilities", 1.0)) or 1.0
    total_assets = bs.get("total assets", 1.0) or 1.0
    total_liabilities = bs.get("total liabilities", 0.0)
    net_income = inc.get("net income", 0.0)

    return {
        "current_ratio": current_assets / current_liabilities,
        "debt_to_assets": total_liabilities / total_assets,
        "return_on_assets": net_income / total_assets,
    }
