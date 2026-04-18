from typing import Dict, Tuple


def _safe_get_numeric(m: Dict, key: str):
    val = m.get(key)
    try:
        return float(val)
    except Exception:
        return None


def validate_arithmetic(document: Dict[str, Dict], tolerances: Dict[str, float] = None) -> Tuple[bool, list]:
    """Perform basic arithmetic checks. Returns (ok, errors).

    Example: check Assets == Liabilities + Equity
    tolerances: dict mapping check name to fractional tolerance (e.g., 0.005 for 0.5%)
    """
    errors = []
    tolerances = tolerances or {}

    bs = document.get("balance_sheet") or {}
    assets = _safe_get_numeric(bs, "Assets")
    liabilities = _safe_get_numeric(bs, "Liabilities")
    equity = _safe_get_numeric(bs, "Equity")

    if assets is not None and liabilities is not None and equity is not None:
        lhs = assets
        rhs = liabilities + equity
        tol = tolerances.get("balance_sheet_equation", 0.005)
        if abs(lhs - rhs) > tol * max(abs(rhs), 1.0):
            errors.append(f"Balance sheet mismatch: Assets ({lhs}) != Liabilities+Equity ({rhs})")

    # Additional checks can be added similarly
    return (len(errors) == 0, errors)
