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

    # Remove common currency symbols, commas, and whitespace
    s = s.replace("$", "").replace("€", "").replace(",", "").replace("\xa0", "")
    # Handle parentheses as negative
    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]

    # Remove stray non-numeric characters
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        val = float(m.group(0))
    except Exception:
        return None
    return -val if negative else val


def _pick_latest_year_map(cf_map: Dict[str, Any]) -> Dict[str, Any]:
    # cf_map may be {"2024": {...}, "2023": {...}} or a flat dict
    years = [k for k in cf_map.keys() if re.fullmatch(r"\d{4}", str(k))]
    if years:
        years_sorted = sorted(years, reverse=True)
        return cf_map.get(years_sorted[0], {})
    return cf_map


def extract(
    input_data: Union[List[Dict[str, Any]], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Extract key cashflow fields from normalized OCR output or legacy chunks.

    Accepts either:
    - normalized dict containing a `cash_flow` key (preferred), or
    - legacy list of chunk dicts.

    Returns a list of fields with keys: label, value, period, confidence (0-1), source(optional).
    """

    results: List[Dict[str, Any]] = []

    if isinstance(input_data, dict) and "cash_flow" in input_data:
        cf = input_data.get("cash_flow") or {}
        cf_entry = _pick_latest_year_map(cf)

        # Common field keys we look for
        candidates = {
            "Opening Cash": [
                "opening cash",
                "cash at beginning",
                "cash, beginning of period",
            ],
            "Net Cash Flow": [
                "net cash flow",
                "net change in cash",
                "net increase (decrease) in cash",
            ],
            "Closing Cash": ["closing cash", "cash at end", "cash, end of period"],
            "Net Income": ["net income", "profit for the year", "net profit"],
        }

        for label, keys in candidates.items():
            value = None
            confidence = 1.0
            source = None
            for k in keys:
                # case-insensitive key lookup
                for fk, fv in list(cf_entry.items()):
                    if isinstance(fk, str) and k in fk.lower():
                        parsed = _parse_number(fv)
                        if parsed is not None:
                            value = parsed
                            # attempt to read confidence if available
                            if isinstance(fv, dict) and "confidence" in fv:
                                confidence = float(fv.get("confidence", 1.0))
                            source = fk
                            break
                if value is not None:
                    break

            # Fallback: if cash_flow contains direct keys
            if value is None and isinstance(cf_entry, dict):
                for fk, fv in cf_entry.items():
                    if (
                        isinstance(fv, (int, float))
                        and label.lower().split()[0] in fk.lower()
                    ):
                        value = float(fv)
                        source = fk
                        break

            results.append(
                {
                    "label": label,
                    "value": value if value is not None else None,
                    "period": "latest",
                    "confidence": confidence,
                    "source": source,
                }
            )

        # Attempt deterministic correction: if opening and net present compute closing
        opening = next((r for r in results if r["label"] == "Opening Cash"), None)
        net = next((r for r in results if r["label"] == "Net Cash Flow"), None)
        closing = next((r for r in results if r["label"] == "Closing Cash"), None)

        if (
            opening
            and net
            and (opening["value"] is not None)
            and (net["value"] is not None)
        ):
            calc_closing = opening["value"] + net["value"]
            if closing and closing.get("value") is None:
                closing["value"] = calc_closing
                closing["confidence"] = (
                    min(opening.get("confidence", 1.0), net.get("confidence", 1.0))
                    * 0.9
                )
            elif closing and closing.get("value") is not None:
                # If mismatch beyond tolerance, lower confidence
                existing = closing["value"]
                if abs(existing - calc_closing) / max(abs(calc_closing), 1.0) > 0.01:
                    closing["confidence"] = min(closing.get("confidence", 1.0), 0.6)

        return results

    # Legacy: simple heuristic extraction from chunks
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
