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


def _pick_latest_year_map(is_map: Dict[str, Any]) -> Dict[str, Any]:
    years = [
        k for k in is_map.keys() if isinstance(k, str) and re.fullmatch(r"\d{4}", k)
    ]
    if years:
        years_sorted = sorted(years, reverse=True)
        return is_map.get(years_sorted[0], {})
    return is_map


def extract(
    input_data: Union[List[Dict[str, Any]], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if isinstance(input_data, dict) and "income_statement" in input_data:
        isec = input_data.get("income_statement") or {}
        is_entry = _pick_latest_year_map(isec)

        candidates = {
            "Revenue": ["revenue", "total revenue", "sales"],
            "COGS": ["cost of goods", "cogs", "cost of sales"],
            "Gross Profit": ["gross profit"],
            "Operating Profit": ["operating profit", "operating income"],
            "Net Income": ["net income", "profit for the year", "net profit"],
        }

        for label, keys in candidates.items():
            value = None
            confidence = 1.0
            source = None
            for k in keys:
                for fk, fv in list(is_entry.items()):
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

        # Derive gross profit if missing and revenue & COGS present
        rev = next((r for r in results if r["label"] == "Revenue"), None)
        cogs = next((r for r in results if r["label"] == "COGS"), None)
        gp = next((r for r in results if r["label"] == "Gross Profit"), None)
        if (
            gp
            and gp.get("value") is None
            and rev
            and cogs
            and rev.get("value") is not None
            and cogs.get("value") is not None
        ):
            gp_val = rev["value"] - cogs["value"]
            gp["value"] = gp_val
            gp["confidence"] = (
                min(rev.get("confidence", 1.0), cogs.get("confidence", 1.0)) * 0.9
            )

        return results

    # legacy chunks
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
