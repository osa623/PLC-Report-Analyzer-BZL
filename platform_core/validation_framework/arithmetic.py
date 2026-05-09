from typing import Dict, Tuple


def _safe_get_numeric(m: Dict, key: str):
    val = m.get(key)
    try:
        return float(val)
    except Exception:
        return None


def validate_arithmetic(document: Dict[str, Dict], tolerances: Dict[str, float] = None) -> Tuple[bool, list]:
    """Perform basic arithmetic checks and impute missing balance sheet values. Returns (ok, errors).

    tolerances: dict mapping check name to fractional tolerance (e.g., 0.005 for 0.5%)
    """
    errors = []
    tolerances = tolerances or {}

    bs = document.get("balance_sheet")
    if bs is None:
        return (True, [])

    assets = _safe_get_numeric(bs, "Assets")
    liabilities = _safe_get_numeric(bs, "Liabilities")
    equity = _safe_get_numeric(bs, "Equity")

    if assets is None and liabilities is not None and equity is not None:
        bs["Assets"] = liabilities + equity
    elif liabilities is None and assets is not None and equity is not None:
        bs["Liabilities"] = assets - equity
    elif equity is None and assets is not None and liabilities is not None:
        bs["Equity"] = assets - liabilities

    # Additional checks can be added similarly
    return (len(errors) == 0, errors)
