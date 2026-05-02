#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "eval" / "extraction_accuracy"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if load_dotenv is not None:
    load_dotenv(dotenv_path=ROOT / ".env", override=False)


def _pdfs_from_path(path: Path) -> list[Path]:
    if path.is_file() and path.suffix.lower() == ".pdf":
        return [path.resolve()]
    if path.is_dir():
        return sorted(p.resolve() for p in path.rglob("*.pdf"))
    return []


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _metric(section: Any, key: str) -> float | None:
    if not isinstance(section, dict):
        return None
    value = section.get(key)
    if key == "revenue":
        if not _is_number(value) or float(value) <= 0:
            value = section.get("total_operating_income")
        if not _is_number(value) or float(value) <= 0:
            value = section.get("net_interest_income")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_operating_cashflow")
    if key == "operating_cash_flow" and not _is_number(value):
        value = section.get("net_cash_flow")
    if key == "net_cash_flow" and not _is_number(value):
        value = section.get("net_cash_change")
    return float(value) if _is_number(value) else None


def _relative_gap(left: float, right: float) -> float:
    denom = max(abs(left), abs(right), 1.0)
    return abs(left - right) / denom


def _year_quality(year_payload: dict[str, Any]) -> dict[str, Any]:
    bs = year_payload.get("balance_sheet") if isinstance(year_payload.get("balance_sheet"), dict) else {}
    inc = year_payload.get("income_statement") if isinstance(year_payload.get("income_statement"), dict) else {}
    cf = year_payload.get("cash_flow") if isinstance(year_payload.get("cash_flow"), dict) else {}

    mandatory = {
        "balance_sheet.total_assets": _metric(bs, "total_assets"),
        "balance_sheet.total_liabilities": _metric(bs, "total_liabilities"),
        "balance_sheet.total_equity": _metric(bs, "total_equity"),
        "income_statement.revenue": _metric(inc, "revenue"),
        "income_statement.net_profit": _metric(inc, "net_profit"),
        "cash_flow.operating_cash_flow": _metric(cf, "operating_cash_flow"),
    }
    mandatory_present = [name for name, value in mandatory.items() if value is not None]

    field_values = []
    total_schema_fields = 0
    present_schema_fields = 0
    for section in (bs, inc, cf):
        if isinstance(section, dict):
            field_values.extend(section.values())
            total_schema_fields += len(section)
            present_schema_fields += sum(1 for key in section.keys() if isinstance(key, str) and key)
    total_fields = len(field_values)
    populated_fields = sum(1 for value in field_values if value is not None)

    assets = mandatory["balance_sheet.total_assets"]
    liabilities = mandatory["balance_sheet.total_liabilities"]
    equity = mandatory["balance_sheet.total_equity"]
    balance_gap = None
    balance_pass = None
    if None not in (assets, liabilities, equity):
        balance_gap = _relative_gap(float(assets), float(liabilities) + float(equity))
        balance_pass = balance_gap <= 0.03

    opening_cash = _metric(cf, "opening_cash")
    net_cash_flow = _metric(cf, "net_cash_flow")
    closing_cash = _metric(cf, "closing_cash")
    cash_gap = None
    cash_pass = None
    if None not in (opening_cash, net_cash_flow, closing_cash):
        cash_gap = _relative_gap(float(opening_cash) + float(net_cash_flow), float(closing_cash))
        cash_pass = cash_gap <= 0.03

    return {
        "mandatory_present": mandatory_present,
        "mandatory_coverage": round(len(mandatory_present) / float(len(mandatory)), 4),
        "field_completeness": round(present_schema_fields / float(total_schema_fields), 4) if total_schema_fields else 0.0,
        "value_density": round(populated_fields / float(total_fields), 4) if total_fields else 0.0,
        "populated_fields": populated_fields,
        "total_fields": total_fields,
        "balance_identity_pass": balance_pass,
        "balance_identity_gap": None if balance_gap is None else round(balance_gap, 6),
        "cash_reconciliation_pass": cash_pass,
        "cash_reconciliation_gap": None if cash_gap is None else round(cash_gap, 6),
    }


def _summarize_dataset(dataset: dict[str, Any]) -> dict[str, Any]:
    years = dataset.get("years") if isinstance(dataset.get("years"), dict) else {}
    per_year = {
        year: _year_quality(payload)
        for year, payload in sorted(years.items(), key=lambda item: int(item[0]) if str(item[0]).isdigit() else 0)
        if isinstance(payload, dict) and str(year).isdigit()
    }
    if not per_year:
        return {
            "years": [],
            "avg_mandatory_coverage": 0.0,
            "avg_field_completeness": 0.0,
            "avg_value_density": 0.0,
            "all_balance_gates_passed": False,
            "all_cash_gates_passed": False,
            "per_year": {},
        }

    mandatory_scores = [item["mandatory_coverage"] for item in per_year.values()]
    completeness_scores = [item["field_completeness"] for item in per_year.values()]
    density_scores = [item["value_density"] for item in per_year.values()]

    def gate_all(gate_name: str) -> bool:
        applicable = [item[gate_name] for item in per_year.values() if item[gate_name] is not None]
        return bool(applicable) and all(bool(value) for value in applicable)

    return {
        "years": list(per_year.keys()),
        "avg_mandatory_coverage": round(sum(mandatory_scores) / len(mandatory_scores), 4),
        "avg_field_completeness": round(sum(completeness_scores) / len(completeness_scores), 4),
        "avg_value_density": round(sum(density_scores) / len(density_scores), 4),
        "all_balance_gates_passed": gate_all("balance_identity_pass"),
        "all_cash_gates_passed": gate_all("cash_reconciliation_pass"),
        "per_year": per_year,
    }


def _disable_gemini_for_offline_proxy() -> None:
    from services.extraction_service.pipeline import gemini_statement_extractor as extractor

    extractor._call_gemini_structured = lambda full_text, detected_years: None
    extractor._call_gemini_structured_vision_style = lambda full_text, detected_years: None


def _extract_direct(pdf_path: Path, report_id: str, offline_proxy: bool) -> dict[str, Any]:
    from services.extraction_service.pipeline.pdf_loader import load_pdf_pages
    from services.extraction_service.pipeline.annual_backend_adapter import extract_with_annual_backend
    from services.extraction_service.pipeline.gemini_statement_extractor import extract_financial_statements_from_text
    from services.extraction_service.strict_pipeline import build_strict_extraction_dataset

    if offline_proxy:
        _disable_gemini_for_offline_proxy()

    pages = load_pdf_pages(str(pdf_path))
    full_text = "\n\n".join(pages)
    output: dict[str, Any] | None = None
    try:
        annual_outputs = extract_with_annual_backend(str(pdf_path), full_text, report_id)
    except Exception:
        annual_outputs = []

    completed_annual = [
        item for item in annual_outputs if isinstance(item, dict) and item.get("status") == "completed"
    ]
    if completed_annual:
        completed_annual = sorted(
            completed_annual,
            key=lambda item: int(item.get("document_year", 0) or 0),
            reverse=True,
        )
        output = dict(completed_annual[0])
        output["comparative_outputs"] = completed_annual

    if output is None:
        output = extract_financial_statements_from_text(
            full_text=full_text,
            file_path=str(pdf_path),
            report_id=report_id,
        )

    extraction_outputs = output.get("comparative_outputs") if isinstance(output.get("comparative_outputs"), list) else [output]
    extraction_outputs = [item for item in extraction_outputs if isinstance(item, dict)]
    strict_dataset = build_strict_extraction_dataset(extraction_outputs)
    return {
        "raw_output_status": output.get("status"),
        "raw_document_year": output.get("document_year"),
        "raw_detected_years": output.get("detected_years", []),
        "raw_metrics_extracted_count": output.get("metrics_extracted_count", 0),
        "raw_missing_required_metrics": output.get("missing_required_metrics", []),
        "raw_quality_issues": output.get("quality_issues", []),
        "strict_extraction": strict_dataset,
    }


def _run_analysis_and_report(strict_dataset: dict[str, Any]) -> dict[str, Any]:
    from services.analysis_service.strict_pipeline import build_strict_analysis_result
    from services.reporting_service.strict_pipeline import build_strict_report

    analysis = build_strict_analysis_result(strict_dataset)
    report = build_strict_report(strict_dataset, analysis)
    return {
        "strict_analysis": analysis,
        "strict_report": report,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate extraction quality against a real PDF set")
    parser.add_argument("path", help="PDF file or folder of source annual-report PDFs")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of PDFs; 0 means all")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--offline-proxy", action="store_true", help="Skip Gemini calls and evaluate local fallback quality only")
    parser.add_argument("--require-google-key", action="store_true", default=True)
    parser.add_argument("--allow-missing-google-key", action="store_true", help="Allow run without GOOGLE_API_KEY; useful with --offline-proxy")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdfs = _pdfs_from_path(Path(args.path))
    if args.limit and args.limit > 0:
        pdfs = pdfs[: args.limit]
    if not pdfs:
        raise SystemExit(f"No PDFs found at {args.path}")

    google_key_present = bool(os.getenv("GOOGLE_API_KEY"))
    if args.require_google_key and not args.allow_missing_google_key and not google_key_present:
        raise SystemExit(
            "GOOGLE_API_KEY is not loaded. Add it to .env or the process environment, "
            "or rerun with --offline-proxy --allow-missing-google-key for a fallback-only proxy run."
        )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = f"{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{os.getpid()}"

    items: list[dict[str, Any]] = []
    for index, pdf_path in enumerate(pdfs, start=1):
        report_id = f"accuracy_{pdf_path.stem}_{stamp}_{index:02d}"
        started = time.perf_counter()
        print(f"[{index}/{len(pdfs)}] extracting {pdf_path.name}")
        try:
            extraction = _extract_direct(pdf_path, report_id, args.offline_proxy)
            strict = extraction.get("strict_extraction") if isinstance(extraction.get("strict_extraction"), dict) else {}
            downstream = _run_analysis_and_report(strict)
            analysis = downstream.get("strict_analysis") if isinstance(downstream.get("strict_analysis"), dict) else {}
            report = downstream.get("strict_report") if isinstance(downstream.get("strict_report"), dict) else {}
            summary = _summarize_dataset(strict)
            valid_years = analysis.get("valid_years") if isinstance(analysis.get("valid_years"), list) else []
            report_tables = report.get("tables") if isinstance(report.get("tables"), dict) else {}
            ok = (
                bool(summary["years"])
                and summary["avg_mandatory_coverage"] >= 0.8
                and bool(valid_years)
                and bool(report_tables)
            )
            item = {
                "pdf": str(pdf_path.relative_to(ROOT)) if pdf_path.is_relative_to(ROOT) else str(pdf_path),
                "ok": ok,
                "duration_seconds": round(time.perf_counter() - started, 2),
                "raw_output_status": extraction.get("raw_output_status"),
                "raw_document_year": extraction.get("raw_document_year"),
                "raw_detected_years": extraction.get("raw_detected_years"),
                "raw_metrics_extracted_count": extraction.get("raw_metrics_extracted_count"),
                "raw_missing_required_metrics": extraction.get("raw_missing_required_metrics"),
                "raw_quality_issues": extraction.get("raw_quality_issues"),
                "document_type": strict.get("document_type"),
                "analysis_status": analysis.get("status", "completed"),
                "analysis_valid_years": valid_years,
                "analysis_rejected_years": analysis.get("rejected_years", []),
                "analysis_validation_flags": analysis.get("validation_flags", []),
                "report_status": report.get("status", "completed"),
                "report_table_count": len(report_tables),
                "report_key_findings_count": len(report.get("key_findings", [])) if isinstance(report.get("key_findings"), list) else 0,
                **summary,
            }
        except Exception as exc:
            item = {
                "pdf": str(pdf_path.relative_to(ROOT)) if pdf_path.is_relative_to(ROOT) else str(pdf_path),
                "ok": False,
                "duration_seconds": round(time.perf_counter() - started, 2),
                "error": str(exc),
            }
        items.append(item)

    successful = [item for item in items if item.get("ok")]
    report = {
        "generated_at": datetime.now().isoformat(),
        "mode": "offline_proxy" if args.offline_proxy else "live_google_gemini",
        "google_key_present": google_key_present,
        "pdf_count": len(items),
        "ok_count": len(successful),
        "ok_rate": round(len(successful) / float(len(items)), 4) if items else 0.0,
        "avg_mandatory_coverage": round(
            sum(float(item.get("avg_mandatory_coverage", 0.0)) for item in items) / float(len(items)),
            4,
        )
        if items
        else 0.0,
        "avg_field_completeness": round(
            sum(float(item.get("avg_field_completeness", 0.0)) for item in items) / float(len(items)),
            4,
        )
        if items
        else 0.0,
        "avg_value_density": round(
            sum(float(item.get("avg_value_density", 0.0)) for item in items) / float(len(items)),
            4,
        )
        if items
        else 0.0,
        "items": items,
    }
    output_path = output_dir / f"extraction_accuracy_{stamp}.json"
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")
    print(f"Saved accuracy report: {output_path}")
    print(
        "Summary: "
        f"{report['ok_count']}/{report['pdf_count']} ok, "
        f"avg mandatory coverage={report['avg_mandatory_coverage']}, "
        f"avg field completeness={report['avg_field_completeness']}, "
        f"avg value density={report['avg_value_density']}"
    )
    return 0 if successful else 1


if __name__ == "__main__":
    raise SystemExit(main())
