from __future__ import annotations

import sys
import io
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from typing import Any

from ..field_maps import SECTION_LABEL_MAPS, add_core_aliases
from .gemini_statement_extractor import (
    MANDATORY_METRICS,
    _document_year,
    _extract_detected_years,
    _extract_quality_issues,
    _mandatory_metrics_coverage,
    _normalize_unit_multiplier,
)


STATEMENT_MAP = {
    "income": "Income_Statement",
    "balance": "Financial Position Statement",
    "cashflow": "Cash Flow Statement",
}

INCOME_MAP = {
    "revenue_or_interest_income": (
        "Total operating income",
        "Gross income",
        "Interest income",
        "Net interest fee and commission income",
        "Net interest income",
    ),
    "cost_of_revenue": ("Interest expenses",),
    "gross_profit": ("Net interest income", "Net operating income", "Gross income"),
    "operating_expenses": ("Total operating expenses", "Operating expenses"),
    "operating_profit": (
        "Operating profit after taxes on financial services",
        "Operating profit before taxes on financial services",
        "Net operating income",
    ),
    "profit_before_tax": ("PROFIT BEFORE INCOME TAX", "Profit before income tax"),
    "tax_expense": ("Income tax expense",),
    "interest_expense": ("Interest expenses",),
    "net_profit": ("PROFIT FOR THE YEAR", "Equity holders of the Bank"),
}

BALANCE_MAP = {
    "total_assets": ("Total assets",),
    "total_liabilities": ("Total liabilities",),
    "cash_and_equivalents": ("Cash and cash equivalents",),
}

CASHFLOW_MAP = {
    "operating_cash_flow": ("Net cash used in/generated from operating activities",),
    "investing_cash_flow": ("Net cash used in from investing activities",),
    "financing_cash_flow": ("Net cash generated in financing activities",),
    "net_cash_change": ("Net increase in cash and cash equivalents",),
    "opening_cash": ("Cash and cash equivalents at the beginning of the period",),
    "closing_cash": ("Cash and cash equivalents at the end of the period",),
}

DEBT_KEYS = (
    "Financial liabilities measured at amortized cost other borrowings",
    "Debt securities issued",
    "Subordinated term debts",
    "Due to banks",
)


def _annual_backend_root() -> Path:
    return Path(__file__).resolve().parents[2] / "annual-report-backend"


def _ensure_annual_backend_path() -> None:
    root = _annual_backend_root()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        if cleaned.startswith("(") and cleaned.endswith(")"):
            cleaned = "-" + cleaned[1:-1]
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _pick(section: dict[str, Any], labels: tuple[str, ...], multiplier: int) -> float | None:
    for label in labels:
        value = _as_float(section.get(label))
        if value is not None:
            return value * multiplier
    lowered = {str(key).strip().lower(): value for key, value in section.items()}
    for label in labels:
        value = _as_float(lowered.get(label.strip().lower()))
        if value is not None:
            return value * multiplier
    return None


def _sum_present(section: dict[str, Any], labels: tuple[str, ...], multiplier: int) -> float | None:
    values = [_as_float(section.get(label)) for label in labels]
    numeric = [float(value) for value in values if value is not None]
    if not numeric:
        return None
    return sum(numeric) * multiplier


def _year_labels(full_text: str, canonical: dict[str, Any]) -> dict[str, int]:
    years = canonical.get("metadata", {}).get("years") if isinstance(canonical.get("metadata"), dict) else {}
    labels: dict[str, int] = {}
    if isinstance(years, dict):
        for label in ("Year1", "Year2"):
            year = years.get(label)
            if isinstance(year, int):
                labels[label] = year
            elif isinstance(year, str) and year.isdigit():
                labels[label] = int(year)

    if labels:
        return labels

    detected = _extract_detected_years(full_text)
    ordered = sorted({int(year) for year in detected if isinstance(year, int)}, reverse=True)
    if ordered:
        labels["Year1"] = ordered[0]
    if len(ordered) > 1:
        labels["Year2"] = ordered[1]

    doc_year = _document_year(full_text)
    if not labels and isinstance(doc_year, int):
        labels["Year1"] = doc_year
    return labels


def _detect_document_type(payload: dict[str, Any]) -> str:
    """Detect if this is a bank or company report from the extracted field names."""
    text_blob = ""
    for section_data in payload.values():
        if isinstance(section_data, dict):
            text_blob += " ".join(str(k).lower() for k in section_data.keys()) + " "
    bank_signals = ["interest income", "due to depositors", "due to banks",
                    "net interest", "impairment charge", "fee and commission",
                    "financial services", "loans and advances"]
    bank_hits = sum(1 for s in bank_signals if s in text_blob)
    return "bank" if bank_hits >= 2 else "company"


def _group_entity_payload(canonical: dict[str, Any], year_label: str) -> tuple[str, dict[str, Any]] | None:
    """Always pick Group entity first. Fall back to Bank/Company only if Group has no data."""
    # Priority order: Group first, then Bank, then Company
    for entity in ("Group", "Bank", "Company"):
        entity_payload = canonical.get(entity)
        if not isinstance(entity_payload, dict):
            continue
        year_payload = entity_payload.get(year_label)
        if not isinstance(year_payload, dict):
            continue
        score = sum(len(v) for v in year_payload.values() if isinstance(v, dict))
        if score > 0:
            return entity, year_payload
    return None


def _translate_year_payload(
    payload: dict[str, Any],
    multiplier: int,
) -> dict[str, dict[str, float | None]]:
    document_type = _detect_document_type(payload)
    maps = SECTION_LABEL_MAPS.get(document_type, SECTION_LABEL_MAPS["company"])
    income_src = payload.get(STATEMENT_MAP["income"]) if isinstance(payload.get(STATEMENT_MAP["income"]), dict) else {}
    balance_src = payload.get(STATEMENT_MAP["balance"]) if isinstance(payload.get(STATEMENT_MAP["balance"]), dict) else {}
    cash_src = payload.get(STATEMENT_MAP["cashflow"]) if isinstance(payload.get(STATEMENT_MAP["cashflow"]), dict) else {}

    income = {
        internal: _pick(income_src, (label,), multiplier)
        for label, internal in maps["income_statement"].items()
    }
    balance = {
        internal: _pick(balance_src, (label,), multiplier)
        for label, internal in maps["balance_sheet"].items()
    }
    cashflow = {
        internal: _pick(cash_src, (label,), multiplier)
        for label, internal in maps["cashflow_statement"].items()
    }

    if balance.get("borrowings") is None:
        balance["borrowings"] = _sum_present(balance_src, DEBT_KEYS, multiplier)

    assets = balance.get("total_assets")
    liabilities = balance.get("total_liabilities")
    if isinstance(assets, (int, float)) and isinstance(liabilities, (int, float)):
        balance["total_equity"] = float(assets) - float(liabilities)
    else:
        balance["total_equity"] = None

    cashflow["net_income"] = income.get("net_profit")

    return {
        "balance_sheet": add_core_aliases("balance_sheet", balance),
        "income_statement": add_core_aliases("income_statement", income),
        "cashflow_statement": add_core_aliases("cashflow_statement", cashflow),
        "equity_statement": {
            "net_income": income.get("net_profit"),
            "change_in_retained_earnings": income.get("net_profit"),
        },
    }


def _value_trace(statements: dict[str, dict[str, Any]], entity: str) -> dict[str, Any]:
    trace: dict[str, Any] = {}
    for section, values in statements.items():
        if not isinstance(values, dict):
            continue
        for field, value in values.items():
            if isinstance(value, (int, float)):
                trace[f"{section}.{field}"] = {
                    "source": "annual_report_backend",
                    "entity": entity,
                    "value": float(value),
                }
    return trace


def extract_with_annual_backend(
    file_path: str,
    full_text: str,
    report_id: str,
) -> list[dict[str, Any]]:
    """Run the annual-report backend extractor and translate it to this service contract."""
    _ensure_annual_backend_path()
    from src.pipeline.two_stage_pipeline import TwoStagePipeline

    currency, multiplier, unit_label, confidence_unit = _normalize_unit_multiplier(full_text)
    if currency != "LKR":
        return []

    pipeline = TwoStagePipeline(
        {
            "validation_tolerance": 0.03,
            "min_page_confidence": 0.45,
            "image_output_dir": "data/processed/statement_images",
        }
    )
    with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
        result = pipeline.extract(file_path, save_intermediates=False)
    canonical = result.get("canonical_output") if isinstance(result, dict) else {}
    if not isinstance(canonical, dict):
        return []

    detected_years = _extract_detected_years(full_text)
    year_labels = _year_labels(full_text, canonical)
    outputs: list[dict[str, Any]] = []

    for year_label, year in sorted(year_labels.items(), key=lambda item: item[1], reverse=True):
        entity_payload = _group_entity_payload(canonical, year_label)
        if entity_payload is None:
            continue
        entity, payload = entity_payload
        statements = _translate_year_payload(payload, multiplier)
        document_type = _detect_document_type(payload)
        extracted_count, missing = _mandatory_metrics_coverage(statements)
        if extracted_count == 0:
            continue

        quality_issues = _extract_quality_issues(statements, year)
        hard_issues = [
            issue
            for issue in quality_issues
            if issue.startswith("unrealistic_magnitude_")
            or issue == "balance_sheet_identity_outside_tolerance"
        ]
        status = "completed" if extracted_count >= len(MANDATORY_METRICS) and not hard_issues else "failed"
        outputs.append(
            {
                "status": status,
                "report_id": report_id,
                "file_path": file_path,
                "document_type": document_type,
                "document_year": int(year),
                "detected_years": detected_years,
                "analysis_years": [int(year)],
                "currency": currency,
                "unit_multiplier": multiplier,
                "unit_detected": unit_label,
                "confidence_unit": confidence_unit,
                "strict_statements": statements,
                "statements": statements,
                "value_trace": _value_trace(statements, entity),
                "metrics_extracted_count": extracted_count,
                "missing_required_metrics": missing,
                "quality_issues": quality_issues,
                "hard_quality_issues": hard_issues,
                "extraction_confidence": min(1.0, extracted_count / float(len(MANDATORY_METRICS))),
                "downscale_factor": None,
                "dual_pass": {
                    "mismatch_fields": [],
                    "agreement_score": 1.0,
                    "source": "annual_report_backend",
                    "entity": entity,
                    "year_label": year_label,
                },
                "failure_reason": None if status == "completed" else "Annual backend extraction did not satisfy mandatory metrics",
                "extractor": "annual_report_backend",
            }
        )

    return outputs
