from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any

from ..integrations.gemini_client import call_gemini


MANDATORY_METRICS = [
    "balance_sheet.total_assets",
    "balance_sheet.total_liabilities",
    "balance_sheet.total_equity",
    "income_statement.revenue_or_interest_income",
    "income_statement.net_profit",
]


FIELD_SYNONYMS: dict[str, list[str]] = {
    "balance_sheet.total_assets": ["total assets"],
    "balance_sheet.total_liabilities": ["total liabilities"],
    "balance_sheet.total_equity": ["total equity", "shareholder equity", "shareholders equity"],
    "balance_sheet.current_assets": ["current assets"],
    "balance_sheet.current_liabilities": ["current liabilities"],
    "balance_sheet.borrowings": ["borrowings", "debt", "total debt"],
    "balance_sheet.cash_and_equivalents": ["cash and cash equivalents", "cash equivalents", "cash and equivalents"],
    "income_statement.revenue_or_interest_income": ["revenue", "interest income", "total income", "sales"],
    "income_statement.cost_of_revenue": ["cost of revenue", "cost of sales", "cost of goods sold", "cogs"],
    "income_statement.gross_profit": ["gross profit"],
    "income_statement.operating_expenses": ["operating expenses", "operating expense"],
    "income_statement.operating_profit": ["operating profit", "operating income"],
    "income_statement.net_profit": ["net profit", "profit for the year", "net income", "profit attributable"],
    "cashflow_statement.operating_cash_flow": ["net cash from operating activities", "operating cash flow", "cash from operations"],
    "cashflow_statement.investing_cash_flow": ["net cash used in investing activities", "investing cash flow"],
    "cashflow_statement.financing_cash_flow": ["net cash from financing activities", "financing cash flow"],
    "cashflow_statement.net_cash_change": ["net increase in cash", "net decrease in cash", "net cash flow"],
}

SECTION_ALIASES: dict[str, list[str]] = {
    "balance_sheet": [
        "statement of financial position",
        "balance sheet",
    ],
    "income_statement": [
        "statement of profit or loss",
        "income statement",
        "statement of comprehensive income",
        "profit and loss",
    ],
    "cashflow_statement": [
        "cash flow statement",
        "statement of cash flows",
    ],
}


def _coerce_float(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)

    text = str(raw).strip()
    if not text:
        return None

    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]

    text = text.replace(",", "").replace(" ", "")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    value = float(match.group(0))
    return -value if negative else value


def _normalize_unit_multiplier(full_text: str) -> tuple[str, int]:
    lowered = full_text.lower()

    has_lkr = any(token in lowered for token in [" lkr", "rs.", "rs ", "rupees", "lkr ", "rs/"])
    has_usd = "usd" in lowered or "us$" in lowered
    if has_usd and not has_lkr:
        return "USD", 1

    # Use explicit accounting notations only; avoid broad keyword inference from narrative text.
    if re.search(r"\b(rs\.?|lkr)\s*'?000\b", lowered):
        return "LKR", 1_000
    if re.search(r"\b(rs\.?|lkr)\s*(mn|million)\b", lowered):
        return "LKR", 1_000_000
    if re.search(r"\b(rs\.?|lkr)\s*(bn|billion)\b", lowered):
        return "LKR", 1_000_000_000

    multiplier = 1

    # If only LKR/Rs is detected without explicit scale notation, keep base values.
    if has_lkr:
        multiplier = 1

    return "LKR", multiplier


def _extract_detected_years(full_text: str) -> list[int]:
    current_year = datetime.now(timezone.utc).year
    anchors = ["year ended", "for the year ended", "as at"]
    statement_markers = [
        "statement of financial position",
        "balance sheet",
        "statement of profit or loss",
        "income statement",
        "cash flow",
    ]
    years: set[int] = set()
    anchored_years: set[int] = set()
    for line in full_text.splitlines():
        lowered = line.lower()
        is_anchor = any(anchor in lowered for anchor in anchors)
        is_statement_line = any(marker in lowered for marker in statement_markers)
        if is_anchor or is_statement_line or "20" in lowered or "19" in lowered:
            for raw in re.findall(r"\b(19\d{2}|20\d{2})\b", line):
                value = int(raw)
                if 1990 <= value <= current_year + 1:
                    years.add(value)
                    if is_anchor or is_statement_line:
                        anchored_years.add(value)

    if anchored_years:
        return sorted(anchored_years)[-5:]

    if not years:
        for raw in re.findall(r"\b(19\d{2}|20\d{2})\b", full_text):
            value = int(raw)
            if 1990 <= value <= current_year + 1:
                years.add(value)
    return sorted(years)[-5:]


def _document_year(full_text: str) -> int | None:
    years = _extract_detected_years(full_text)
    return max(years) if years else None


def _safe_get_field(payload: dict[str, Any], key_path: str) -> Any:
    current: Any = payload
    for part in key_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current.get(part)
    return current


def _safe_set_field(payload: dict[str, Any], key_path: str, value: Any) -> None:
    parts = key_path.split(".")
    current = payload
    for part in parts[:-1]:
        if part not in current or not isinstance(current[part], dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def _fallback_regex_extract(full_text: str) -> dict[str, Any]:
    extracted: dict[str, Any] = {
        "balance_sheet": {},
        "income_statement": {},
        "cashflow_statement": {},
    }

    for field_path, synonyms in FIELD_SYNONYMS.items():
        value = None
        for line in full_text.splitlines():
            lowered = line.lower()
            if not any(s in lowered for s in synonyms):
                continue
            # Prefer values that look like the rightmost table number.
            matches = re.findall(r"\(?-?\d[\d,]*(?:\.\d+)?\)?", line)
            if matches:
                value = _coerce_float(matches[-1])
                if value is not None:
                    break
        if value is not None:
            _safe_set_field(extracted, field_path, value)

    return extracted


def _is_year_token(value: float) -> bool:
    as_int = int(abs(value))
    return float(as_int) == abs(value) and 1990 <= as_int <= 2100


def _extract_line_number_candidates(line: str) -> list[float]:
    tokens = re.findall(r"\(?-?\d{1,3}(?:[\s,]\d{3})+(?:\.\d+)?\)?|\(?-?\d+(?:\.\d+)?\)?", line)
    values: list[float] = []
    for token in tokens:
        parsed = _coerce_float(token)
        if parsed is None:
            continue
        if _is_year_token(parsed):
            continue
        values.append(parsed)
    return values


def _pick_financial_value_from_line(line: str) -> float | None:
    values = _extract_line_number_candidates(line)
    if not values:
        return None

    # Drop likely note/reference number when present as first tiny integer.
    if len(values) >= 2 and abs(values[0]) < 1000 and abs(values[1]) >= 1000:
        values = values[1:]

    # Prefer the largest magnitude value on the row to avoid selecting note indices.
    return max(values, key=lambda v: abs(float(v)))


def _section_heading_index(lines: list[str], aliases: list[str]) -> int | None:
    for idx, line in enumerate(lines):
        lowered = line.lower()
        if any(alias in lowered for alias in aliases):
            return idx
    return None


def _section_end_index(lines: list[str], start_idx: int) -> int:
    end = min(len(lines), start_idx + 260)
    for idx in range(start_idx + 1, min(len(lines), start_idx + 300)):
        lowered = lines[idx].lower()
        if any(alias in lowered for aliases in SECTION_ALIASES.values() for alias in aliases):
            end = idx
            break
    return end


def _extract_section_window(lines: list[str], section_key: str) -> list[str]:
    aliases = SECTION_ALIASES.get(section_key, [])
    start = _section_heading_index(lines, aliases)
    if start is None:
        return []
    end = _section_end_index(lines, start)
    return lines[start:end]


def _section_anchored_extract(full_text: str) -> dict[str, Any]:
    lines = [ln.strip() for ln in full_text.splitlines() if ln and ln.strip()]
    extracted: dict[str, Any] = {
        "balance_sheet": {},
        "income_statement": {},
        "cashflow_statement": {},
    }

    for field_path, synonyms in FIELD_SYNONYMS.items():
        section, field = field_path.split(".", 1)
        window = _extract_section_window(lines, section)
        if not window:
            continue

        candidates: list[float] = []
        for line in window:
            lowered = line.lower()
            if not any(s in lowered for s in synonyms):
                continue
            candidate = _pick_financial_value_from_line(line)
            if candidate is None:
                continue
            candidates.append(candidate)

        if candidates:
            extracted[section][field] = max(candidates, key=lambda v: abs(float(v)))

    return extracted


def _is_plausible_value(field_path: str, value: Any) -> bool:
    if not isinstance(value, (int, float)):
        return False
    fv = float(value)
    if abs(fv) > 1e14:
        return False
    if field_path in {
        "balance_sheet.total_assets",
        "balance_sheet.total_liabilities",
        "income_statement.revenue_or_interest_income",
    } and fv <= 0:
        return False
    return True


def _coalesce_statement_sources(model: dict[str, Any], section: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "balance_sheet": {},
        "income_statement": {},
        "cashflow_statement": {},
    }
    mandatory_set = set(MANDATORY_METRICS)
    for field_path in FIELD_SYNONYMS.keys():
        section_key, field_key = field_path.split(".", 1)
        model_val = (model.get(section_key) or {}).get(field_key) if isinstance(model.get(section_key), dict) else None
        section_val = (section.get(section_key) or {}).get(field_key) if isinstance(section.get(section_key), dict) else None
        fallback_val = (fallback.get(section_key) or {}).get(field_key) if isinstance(fallback.get(section_key), dict) else None

        plausible_candidates = [
            c for c in (section_val, model_val, fallback_val)
            if _is_plausible_value(field_path, c)
        ]

        if field_path in mandatory_set and field_path != "income_statement.net_profit" and plausible_candidates:
            merged[section_key][field_key] = max(plausible_candidates, key=lambda v: abs(float(v)))
            continue

        if field_path == "income_statement.net_profit" and plausible_candidates:
            revenue = (merged.get("income_statement") or {}).get("revenue_or_interest_income")
            if isinstance(revenue, (int, float)) and float(revenue) != 0:
                bounded = [
                    c for c in plausible_candidates
                    if abs(float(c)) <= abs(float(revenue)) * 2.5
                ]
                if bounded:
                    merged[section_key][field_key] = max(bounded, key=lambda v: abs(float(v)))
                else:
                    merged[section_key][field_key] = min(plausible_candidates, key=lambda v: abs(float(v)))
            else:
                merged[section_key][field_key] = min(plausible_candidates, key=lambda v: abs(float(v)))
            continue

        chosen = None
        candidate_order = (section_val, model_val, fallback_val) if field_path in mandatory_set else (model_val, section_val, fallback_val)
        for candidate in candidate_order:
            if _is_plausible_value(field_path, candidate):
                chosen = candidate
                break
        if chosen is None:
            chosen = section_val if field_path in mandatory_set and section_val is not None else (
                model_val if model_val is not None else section_val if section_val is not None else fallback_val
            )
        merged[section_key][field_key] = chosen
    return merged


def _repair_balance_identity(statements: dict[str, Any]) -> dict[str, Any]:
    bs = statements.get("balance_sheet")
    if not isinstance(bs, dict):
        return statements

    assets = bs.get("total_assets")
    liabilities = bs.get("total_liabilities")
    equity = bs.get("total_equity")

    if not all(isinstance(v, (int, float)) for v in (assets, liabilities, equity)):
        return statements

    lhs = float(assets)
    rhs = float(liabilities) + float(equity)
    denom = max(abs(lhs), abs(rhs), 1.0)
    rel_gap = abs(lhs - rhs) / denom
    if rel_gap <= 0.35:
        return statements

    candidates: list[tuple[str, float, float]] = []

    implied_assets = float(liabilities) + float(equity)
    if implied_assets > 0:
        delta = abs(implied_assets - float(assets)) / max(abs(float(assets)), 1.0)
        candidates.append(("total_assets", implied_assets, delta))

    implied_liabilities = float(assets) - float(equity)
    if implied_liabilities >= 0:
        delta = abs(implied_liabilities - float(liabilities)) / max(abs(float(liabilities)), 1.0)
        candidates.append(("total_liabilities", implied_liabilities, delta))

    implied_equity = float(assets) - float(liabilities)
    if implied_equity > 0:
        delta = abs(implied_equity - float(equity)) / max(abs(float(equity)), 1.0)
        candidates.append(("total_equity", implied_equity, delta))

    if not candidates:
        return statements

    field_name, repaired_value, _ = min(candidates, key=lambda item: item[2])

    repaired = dict(statements)
    repaired_bs = dict(bs)
    repaired_bs[field_name] = repaired_value
    repaired["balance_sheet"] = repaired_bs
    return repaired


def _normalize_mandatory_magnitude(statements: dict[str, Any], unit_multiplier: int) -> dict[str, Any]:
    if unit_multiplier < 1000:
        return statements

    bs = statements.get("balance_sheet") if isinstance(statements.get("balance_sheet"), dict) else {}
    inc = statements.get("income_statement") if isinstance(statements.get("income_statement"), dict) else {}

    mandatory_values = [
        bs.get("total_assets"),
        bs.get("total_liabilities"),
        bs.get("total_equity"),
        inc.get("revenue_or_interest_income"),
        inc.get("net_profit"),
    ]
    numeric = [float(v) for v in mandatory_values if isinstance(v, (int, float))]
    if len(numeric) < 3:
        return statements
    if max(abs(v) for v in numeric) >= 1_000_000:
        return statements

    scaled = dict(statements)
    scaled_bs = dict(bs)
    scaled_inc = dict(inc)
    for key in ("total_assets", "total_liabilities", "total_equity"):
        if isinstance(scaled_bs.get(key), (int, float)):
            scaled_bs[key] = float(scaled_bs[key]) * 1000.0
    for key in ("revenue_or_interest_income", "net_profit"):
        if isinstance(scaled_inc.get(key), (int, float)):
            scaled_inc[key] = float(scaled_inc[key]) * 1000.0
    scaled["balance_sheet"] = scaled_bs
    scaled["income_statement"] = scaled_inc
    return scaled


def _clamp_income_outliers(statements: dict[str, Any]) -> dict[str, Any]:
    inc = statements.get("income_statement")
    if not isinstance(inc, dict):
        return statements
    revenue = inc.get("revenue_or_interest_income")
    if not isinstance(revenue, (int, float)) or float(revenue) == 0:
        return statements

    adjusted = dict(statements)
    adjusted_inc = dict(inc)
    limit = abs(float(revenue)) * 500.0
    for key in ("cost_of_revenue", "gross_profit", "operating_expenses", "operating_profit", "net_profit"):
        value = adjusted_inc.get(key)
        if not isinstance(value, (int, float)):
            continue
        fv = float(value)
        while abs(fv) > limit and abs(fv) > 1_000_000:
            fv = fv / 1000.0
        adjusted_inc[key] = fv

    adjusted["income_statement"] = adjusted_inc
    return adjusted


def _parse_model_json(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = raw[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _build_gemini_prompt(full_text: str, detected_years: list[int]) -> str:
    years_hint = ", ".join(str(y) for y in detected_years) if detected_years else "unknown"
    truncated = full_text[:140000]
    return (
        "You are an OCR financial statement extraction engine. "
        "Extract LKR-denominated financial statement values only. "
        "Ignore USD values. Return JSON only with this shape: "
        "{\"document_year\": 2023, \"statements\": {\"balance_sheet\": {...}, \"income_statement\": {...}, \"cashflow_statement\": {...}}}. "
        "If a field is missing use null. "
        "Balance sheet keys: total_assets,total_liabilities,total_equity,current_assets,current_liabilities,borrowings,cash_and_equivalents. "
        "Income keys: revenue_or_interest_income,cost_of_revenue,gross_profit,operating_expenses,operating_profit,net_profit. "
        "Cashflow keys: operating_cash_flow,investing_cash_flow,financing_cash_flow,net_cash_change. "
        f"Detected year candidates: {years_hint}. "
        "Source OCR text follows:\n"
        f"{truncated}"
    )


def _call_gemini_structured(full_text: str, detected_years: list[int]) -> dict[str, Any] | None:
    prompt = _build_gemini_prompt(full_text, detected_years)
    try:
        response = asyncio.run(call_gemini(prompt, max_output_tokens=3072))
    except Exception:
        return None
    model_text = response.get("text") if isinstance(response, dict) else ""
    if not isinstance(model_text, str):
        return None
    return _parse_model_json(model_text)


def _normalize_statements(raw_statements: dict[str, Any], multiplier: int) -> dict[str, dict[str, float | None]]:
    normalized = {
        "balance_sheet": {},
        "income_statement": {},
        "cashflow_statement": {},
    }

    for section in normalized.keys():
        values = raw_statements.get(section) if isinstance(raw_statements, dict) else {}
        if not isinstance(values, dict):
            continue
        for key, raw_value in values.items():
            parsed = _coerce_float(raw_value)
            normalized[section][key] = None if parsed is None else float(parsed) * multiplier
    return normalized


def _merge_statement_values(preferred: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "balance_sheet": {},
        "income_statement": {},
        "cashflow_statement": {},
    }
    for section in merged.keys():
        preferred_values = preferred.get(section) if isinstance(preferred, dict) else {}
        fallback_values = fallback.get(section) if isinstance(fallback, dict) else {}
        keys = set()
        if isinstance(preferred_values, dict):
            keys.update(preferred_values.keys())
        if isinstance(fallback_values, dict):
            keys.update(fallback_values.keys())
        for key in keys:
            value = preferred_values.get(key) if isinstance(preferred_values, dict) else None
            if value is None and isinstance(fallback_values, dict):
                value = fallback_values.get(key)
            merged[section][key] = value
    return merged


def _rescale_values(payload: dict[str, Any], divisor: float) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for section, values in payload.items():
        if not isinstance(values, dict):
            continue
        output[section] = {}
        for key, value in values.items():
            if isinstance(value, (int, float)):
                output[section][key] = float(value) / divisor
            else:
                output[section][key] = value
    return output


def _maybe_downscale_unrealistic_values(statements: dict[str, Any]) -> tuple[dict[str, Any], int | None]:
    bs = statements.get("balance_sheet") if isinstance(statements.get("balance_sheet"), dict) else {}
    inc = statements.get("income_statement") if isinstance(statements.get("income_statement"), dict) else {}
    key_values = [
        bs.get("total_assets"),
        bs.get("total_liabilities"),
        bs.get("total_equity"),
        inc.get("revenue_or_interest_income"),
        inc.get("net_profit"),
    ]
    numeric = [float(v) for v in key_values if isinstance(v, (int, float))]
    if len(numeric) < 3:
        return statements, None

    max_abs = max(abs(v) for v in numeric)
    if max_abs <= 1e14:
        return statements, None

    # Scale only when several key metrics are simultaneously very large.
    large_count = sum(1 for v in numeric if abs(v) >= 1e11)
    if large_count < 3:
        return statements, None

    for factor in (1_000, 1_000_000, 1_000_000_000):
        scaled = _rescale_values(statements, factor)
        sbs = scaled.get("balance_sheet", {})
        sinc = scaled.get("income_statement", {})
        probe = [
            sbs.get("total_assets"),
            sbs.get("total_liabilities"),
            sbs.get("total_equity"),
            sinc.get("revenue_or_interest_income"),
            sinc.get("net_profit"),
        ]
        sn = [float(v) for v in probe if isinstance(v, (int, float))]
        if len(sn) < 3:
            continue
        if max(abs(v) for v in sn) <= 1e13:
            return scaled, factor

    return statements, None


def _mandatory_metrics_coverage(statements: dict[str, Any]) -> tuple[int, list[str]]:
    present = 0
    missing: list[str] = []
    for metric in MANDATORY_METRICS:
        value = _safe_get_field(statements, metric)
        if isinstance(value, (int, float)):
            present += 1
        else:
            missing.append(metric)
    return present, missing


def _extract_quality_issues(statements: dict[str, Any], document_year: int | None) -> list[str]:
    issues: list[str] = []

    if document_year is None:
        issues.append("document_year_not_detected")

    bs = statements.get("balance_sheet") if isinstance(statements.get("balance_sheet"), dict) else {}
    inc = statements.get("income_statement") if isinstance(statements.get("income_statement"), dict) else {}

    total_assets = bs.get("total_assets")
    total_liabilities = bs.get("total_liabilities")
    total_equity = bs.get("total_equity")
    revenue = inc.get("revenue_or_interest_income")
    net_profit = inc.get("net_profit")

    def is_num(v: Any) -> bool:
        return isinstance(v, (int, float))

    if is_num(total_assets) and float(total_assets) <= 0:
        issues.append("non_positive_total_assets")
    if is_num(total_liabilities) and float(total_liabilities) < 0:
        issues.append("negative_total_liabilities")
    if is_num(revenue) and float(revenue) <= 0:
        issues.append("non_positive_revenue")

    # Guard against obvious OCR misreads that inflate numbers by multiple orders of magnitude.
    magnitude_limit = 1e14
    for name, value in {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "revenue_or_interest_income": revenue,
        "net_profit": net_profit,
    }.items():
        if is_num(value) and abs(float(value)) > magnitude_limit:
            issues.append(f"unrealistic_magnitude_{name}")

    # Basic accounting consistency tolerance.
    if is_num(total_assets) and is_num(total_liabilities) and is_num(total_equity):
        lhs = float(total_assets)
        rhs = float(total_liabilities) + float(total_equity)
        denom = max(abs(lhs), abs(rhs), 1.0)
        if abs(lhs - rhs) / denom > 0.35:
            issues.append("balance_sheet_identity_outside_tolerance")

    return issues


def extract_financial_statements_from_text(full_text: str, file_path: str, report_id: str) -> dict[str, Any]:
    detected_years = _extract_detected_years(full_text)
    doc_year = _document_year(full_text)

    currency, multiplier = _normalize_unit_multiplier(full_text)
    if currency != "LKR":
        return {
            "status": "failed",
            "report_id": report_id,
            "file_path": file_path,
            "document_year": doc_year,
            "detected_years": detected_years,
            "metrics_extracted_count": 0,
            "missing_required_metrics": MANDATORY_METRICS,
            "failure_reason": "Only LKR-denominated statement extraction is supported",
        }

    model_payload = _call_gemini_structured(full_text, detected_years) or {}
    model_statements = model_payload.get("statements") if isinstance(model_payload, dict) else {}
    normalized_model = _normalize_statements(model_statements if isinstance(model_statements, dict) else {}, multiplier)
    normalized_section = _normalize_statements(_section_anchored_extract(full_text), multiplier)
    normalized_fallback = _normalize_statements(_fallback_regex_extract(full_text), multiplier)
    merged_statements = _coalesce_statement_sources(normalized_model, normalized_section, normalized_fallback)
    merged_statements = _normalize_mandatory_magnitude(merged_statements, multiplier)
    merged_statements = _clamp_income_outliers(merged_statements)
    merged_statements = _repair_balance_identity(merged_statements)
    merged_statements, downscale_factor = _maybe_downscale_unrealistic_values(merged_statements)

    if doc_year is None and isinstance(model_payload.get("document_year"), int):
        doc_year = int(model_payload.get("document_year"))

    extracted_count, missing = _mandatory_metrics_coverage(merged_statements)
    quality_issues = _extract_quality_issues(merged_statements, doc_year)
    extraction_confidence = min(1.0, extracted_count / float(len(MANDATORY_METRICS)))
    status = "completed" if extracted_count >= 5 and not quality_issues else "failed"
    failure_reason = None
    if extracted_count < 5:
        failure_reason = "Fewer than 5 mandatory metrics detected"
    elif quality_issues:
        failure_reason = f"Extraction quality gate failed: {', '.join(quality_issues)}"

    return {
        "status": status,
        "report_id": report_id,
        "file_path": file_path,
        "document_year": doc_year,
        "detected_years": detected_years,
        "currency": currency,
        "unit_multiplier": multiplier,
        "statements": merged_statements,
        "metrics_extracted_count": extracted_count,
        "missing_required_metrics": missing,
        "quality_issues": quality_issues,
        "extraction_confidence": extraction_confidence,
        "downscale_factor": downscale_factor,
        "failure_reason": failure_reason,
    }
