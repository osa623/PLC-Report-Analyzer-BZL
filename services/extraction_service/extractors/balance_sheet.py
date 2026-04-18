from __future__ import annotations

import re
from typing import Any, Dict, List, Union


def _parse_number(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip()
    if s == "" or s.upper() in ("N/A", "NULL"):
        return None
    s = s.replace("$", "").replace(",", "").replace("\xa0", "")
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        val = float(m.group(0))
    except Exception:
        return None
    return -val if negative else val


def _pick_latest_year_map(bs_map: Dict[str, Any]) -> Dict[str, Any]:
    years = [
        k for k in bs_map.keys() if isinstance(k, str) and re.fullmatch(r"\d{4}", k)
    ]
    if years:
        years_sorted = sorted(years, reverse=True)
        return bs_map.get(years_sorted[0], {})
    return bs_map


def extract(
    input_data: Union[List[Dict[str, Any]], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if isinstance(input_data, dict) and "balance_sheet" in input_data:
        bs = input_data.get("balance_sheet") or {}
        bs_entry = _pick_latest_year_map(bs)

        candidates = {
            "Total Assets": ["assets", "total assets"],
            "Total Liabilities": ["liabilities", "total liabilities"],
            "Total Equity": ["equity", "total equity", "shareholders' equity"],
        }

        for label, keys in candidates.items():
            value = None
            confidence = 1.0
            source = None
            for k in keys:
                for fk, fv in list(bs_entry.items()):
                    if isinstance(fk, str) and k in fk.lower():
                        parsed = _parse_number(fv)
                        if parsed is not None:
                            value = parsed
                            if isinstance(fv, dict) and "confidence" in fv:
                                confidence = float(fv.get("confidence", 1.0))
                            source = fk
                            break
                if value is not None:
                    break

            results.append(
                {
                    "label": label,
                    "value": value,
                    "period": "latest",
                    "confidence": confidence,
                    "source": source,
                }
            )

        # Derive equity if missing: Equity = Assets - Liabilities
        assets = next((r for r in results if r["label"] == "Total Assets"), None)
        liabilities = next(
            (r for r in results if r["label"] == "Total Liabilities"), None
        )
        equity = next((r for r in results if r["label"] == "Total Equity"), None)
        if (
            equity
            and equity.get("value") is None
            and assets
            and liabilities
            and assets.get("value") is not None
            and liabilities.get("value") is not None
        ):
            calc_equity = assets["value"] - liabilities["value"]
            equity["value"] = calc_equity
            equity["confidence"] = (
                min(assets.get("confidence", 1.0), liabilities.get("confidence", 1.0))
                * 0.9
            )

        return results

    # Legacy: parse list of chunks
    if isinstance(input_data, list):
        for item in input_data:
            label = item.get("label") or item.get("name") or "unknown"
            value = _parse_number(item.get("value") or item.get("text"))
            results.append(
                {
                    "label": label,
                    "value": value,
                    "period": item.get("period", "current"),
                    "confidence": item.get("confidence", 1.0),
                }
            )
        return results

    return results
