from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import get_config
from .job_manager import mark_failed, mark_running, mark_success
from .pipeline.pdf_loader import load_pdf_pages
from .pipeline.gemini_statement_extractor import extract_financial_statements_from_text
from .redis_client import get_redis
from .storage.canonical_raw_repository import save_canonical_raw
from platform_core.shared_infra.redis_client import set_json
from platform_core.temp_financial_repository import insert_temporary_financial_statement

app = FastAPI(title="extraction-service", version="1.0.0")
cfg = get_config()


class ExtractRequest(BaseModel):
    report_id: str
    file_path: str | None = None
    file_paths: list[str] | None = None


def _resolve_input_paths(request: ExtractRequest) -> list[str]:
    if isinstance(request.file_paths, list) and request.file_paths:
        return [p for p in request.file_paths if isinstance(p, str) and p.strip()]
    if isinstance(request.file_path, str) and request.file_path.strip():
        return [request.file_path]
    return []


def _to_canonical_line_items(extractions: list[dict[str, Any]]) -> dict[str, Any]:
    income_statement: list[dict[str, Any]] = []
    balance_sheet: list[dict[str, Any]] = []
    cashflow: list[dict[str, Any]] = []
    equity: list[dict[str, Any]] = []

    def add_item(target: list[dict[str, Any]], label: str, value: Any, year: int | None) -> None:
        if not isinstance(value, (int, float)):
            return
        target.append(
            {
                "label": label,
                "value": float(value),
                "period": str(year) if isinstance(year, int) else "latest",
                "currency": "LKR",
            }
        )

    for extraction in extractions:
        year = extraction.get("document_year")
        statements = extraction.get("statements") if isinstance(extraction.get("statements"), dict) else {}
        bs = statements.get("balance_sheet") if isinstance(statements.get("balance_sheet"), dict) else {}
        inc = statements.get("income_statement") if isinstance(statements.get("income_statement"), dict) else {}
        cf = statements.get("cashflow_statement") if isinstance(statements.get("cashflow_statement"), dict) else {}

        add_item(balance_sheet, "Total Assets", bs.get("total_assets"), year)
        add_item(balance_sheet, "Total Liabilities", bs.get("total_liabilities"), year)
        add_item(balance_sheet, "Total Equity", bs.get("total_equity"), year)
        add_item(balance_sheet, "Current Assets", bs.get("current_assets"), year)
        add_item(balance_sheet, "Current Liabilities", bs.get("current_liabilities"), year)
        add_item(balance_sheet, "Debt", bs.get("borrowings"), year)
        add_item(balance_sheet, "Cash and Equivalents", bs.get("cash_and_equivalents"), year)

        add_item(income_statement, "Revenue", inc.get("revenue_or_interest_income"), year)
        add_item(income_statement, "Cost of Revenue", inc.get("cost_of_revenue"), year)
        add_item(income_statement, "Gross Profit", inc.get("gross_profit"), year)
        add_item(income_statement, "Operating Expenses", inc.get("operating_expenses"), year)
        add_item(income_statement, "Operating Profit", inc.get("operating_profit"), year)
        add_item(income_statement, "Profit Before Tax", inc.get("profit_before_tax"), year)
        add_item(income_statement, "Interest Expense", inc.get("interest_expense"), year)
        add_item(income_statement, "Net Income", inc.get("net_profit"), year)

        add_item(cashflow, "Operating Cash Flow", cf.get("operating_cash_flow"), year)
        add_item(cashflow, "Investing Cash Flow", cf.get("investing_cash_flow"), year)
        add_item(cashflow, "Financing Cash Flow", cf.get("financing_cash_flow"), year)
        add_item(cashflow, "Net Cash Flow", cf.get("net_cash_change"), year)
        add_item(cashflow, "Opening Cash", cf.get("opening_cash"), year)
        add_item(cashflow, "Closing Cash", cf.get("closing_cash"), year)
        add_item(cashflow, "Net Income", cf.get("net_income"), year)

        eq = statements.get("equity_statement") if isinstance(statements.get("equity_statement"), dict) else {}
        add_item(equity, "Net Income", eq.get("net_income"), year)
        add_item(equity, "Change in Retained Earnings", eq.get("change_in_retained_earnings"), year)

    return {
        "financial_statements": {
            "income_statement": income_statement,
            "balance_sheet": balance_sheet,
            "cashflow": cashflow,
            "equity": equity,
        },
        "narrative_sections": {
            "notes": [],
            "risk": [],
            "governance": [],
            "esg": [],
            "segment": [],
        },
    }


def _document_status_key(report_id: str) -> str:
    return f"report:{report_id}:document_statuses"


def _set_document_status(redis, report_id: str, file_path: str, ttl_seconds: int, status: str, **extra: Any) -> None:
    payload = {
        "file_path": file_path,
        "status": status,
        **extra,
    }
    redis.hset(_document_status_key(report_id), file_path, json.dumps(payload, ensure_ascii=True, default=str))
    redis.expire(_document_status_key(report_id), ttl_seconds)


def _extract_single_file(redis, report_id: str, file_path: str, ttl_seconds: int) -> tuple[dict[str, Any], int]:
    start = time.perf_counter()
    _set_document_status(redis, report_id, file_path, ttl_seconds, "running")
    pages = load_pdf_pages(file_path)
    full_text = "\n\n".join(pages)

    output: dict[str, Any] | None = None
    focus_fields: list[str] = []
    attempts = 0
    max_attempts = 3
    while attempts < max_attempts:
        attempts += 1
        output = extract_financial_statements_from_text(
            full_text,
            file_path,
            report_id,
            strict_mode=attempts > 1,
            focus_fields=focus_fields,
        )
        if output.get("status") == "completed":
            break

        missing = output.get("missing_required_metrics", [])
        quality_issues = output.get("quality_issues", [])
        focus_fields = [m for m in missing if isinstance(m, str)]
        if not focus_fields and quality_issues:
            for issue in quality_issues:
                lowered = str(issue).lower()
                if "balance" in lowered:
                    focus_fields.extend([
                        "balance_sheet.total_assets",
                        "balance_sheet.total_liabilities",
                        "balance_sheet.total_equity",
                    ])
                if "cash" in lowered:
                    focus_fields.extend([
                        "cashflow_statement.operating_cash_flow",
                        "cashflow_statement.closing_cash",
                    ])
                if "profit" in lowered or "revenue" in lowered:
                    focus_fields.extend([
                        "income_statement.revenue_or_interest_income",
                        "income_statement.net_profit",
                    ])
        focus_fields = sorted(set(focus_fields))

    output = output or {}
    output["re_extraction_attempts"] = attempts
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    if output.get("status") == "failed":
        statements = output.get("statements") if isinstance(output.get("statements"), dict) else {}
        bs = statements.get("balance_sheet") if isinstance(statements.get("balance_sheet"), dict) else {}
        inc = statements.get("income_statement") if isinstance(statements.get("income_statement"), dict) else {}
        diagnostic = {
            "file_path": file_path,
            "failure_reason": output.get("failure_reason") or "extraction failed",
            "document_year": output.get("document_year"),
            "detected_years": output.get("detected_years", []),
            "metrics_extracted_count": int(output.get("metrics_extracted_count", 0)),
            "missing_required_metrics": output.get("missing_required_metrics", []),
            "quality_issues": output.get("quality_issues", []),
            "re_extraction_attempts": int(output.get("re_extraction_attempts", attempts)),
            "dual_pass": output.get("dual_pass", {}),
            "critical_values": {
                "total_assets": bs.get("total_assets"),
                "total_liabilities": bs.get("total_liabilities"),
                "total_equity": bs.get("total_equity"),
                "revenue_or_interest_income": inc.get("revenue_or_interest_income"),
                "net_profit": inc.get("net_profit"),
            },
        }
        _set_document_status(
            redis,
            report_id,
            file_path,
            ttl_seconds,
            "failed",
            duration_ms=elapsed_ms,
            error=diagnostic["failure_reason"],
            diagnostics=diagnostic,
        )
        raise RuntimeError(json.dumps(diagnostic, ensure_ascii=True))

    _set_document_status(
        redis,
        report_id,
        file_path,
        ttl_seconds,
        "completed",
        page_count=len(pages),
        duration_ms=elapsed_ms,
        document_year=output.get("document_year"),
        metrics_extracted_count=output.get("metrics_extracted_count", 0),
        re_extraction_attempts=int(output.get("re_extraction_attempts", attempts)),
        extraction_agreement_score=(output.get("dual_pass") or {}).get("agreement_score"),
    )
    return output, len(pages)


@app.post("/extract")
def extract(request: ExtractRequest) -> dict[str, Any]:
    redis = get_redis()
    try:
        mark_running(redis, request.report_id)

        input_paths = _resolve_input_paths(request)
        if not input_paths:
            raise ValueError("file_path or file_paths is required")

        for file_path in input_paths:
            _set_document_status(redis, request.report_id, file_path, cfg.redis_ttl_seconds, "queued")

        extraction_outputs_by_path: dict[str, dict[str, Any]] = {}
        total_pages = 0
        file_errors: list[dict[str, str]] = []

        max_workers = min(len(input_paths), max(1, os.cpu_count() or 1), 8)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_path = {
                executor.submit(_extract_single_file, redis, request.report_id, file_path, cfg.redis_ttl_seconds): file_path
                for file_path in input_paths
            }

            for future in as_completed(future_to_path):
                file_path = future_to_path[future]
                try:
                    output, page_count = future.result()
                    extraction_outputs_by_path[file_path] = output
                    total_pages += page_count
                    year = output.get("document_year")
                    if not isinstance(year, int):
                        raise RuntimeError("document_year not detected")
                    insert_temporary_financial_statement(
                        {
                            "report_id": request.report_id,
                            "year": year,
                            "source_report_year": output.get("document_year"),
                            "currency": output.get("currency"),
                            "unit_multiplier": output.get("unit_multiplier"),
                            "unit_detected": output.get("unit_detected"),
                            "confidence_unit": output.get("confidence_unit"),
                            "balance_sheet": output["statements"].get("balance_sheet", {}),
                            "income_statement": output["statements"].get("income_statement", {}),
                            "cashflow_statement": output["statements"].get("cashflow_statement", {}),
                            "equity_statement": output["statements"].get("equity_statement", {}),
                            "value_trace": output.get("value_trace", {}),
                            "source_file": file_path,
                            "extraction_confidence": output.get("extraction_confidence", 0.0),
                            "metrics_extracted_count": int(output.get("metrics_extracted_count", 0)),
                            "re_extraction_attempts": int(output.get("re_extraction_attempts", 1)),
                            "extraction_agreement_score": float(((output.get("dual_pass") or {}).get("agreement_score", 0.0) or 0.0)),
                            "dual_pass": output.get("dual_pass", {}),
                        }
                    )
                except Exception as exc:
                    parsed_error: dict[str, Any] | None = None
                    try:
                        candidate = json.loads(str(exc))
                        if isinstance(candidate, dict):
                            parsed_error = candidate
                    except Exception:
                        parsed_error = None

                    _set_document_status(
                        redis,
                        request.report_id,
                        file_path,
                        cfg.redis_ttl_seconds,
                        "failed",
                        error=(parsed_error or {}).get("failure_reason", str(exc)),
                    )
                    file_errors.append(
                        {
                            "file_path": file_path,
                            "error": (parsed_error or {}).get("failure_reason", str(exc)),
                            "document_year": (parsed_error or {}).get("document_year"),
                            "detected_years": (parsed_error or {}).get("detected_years", []),
                            "metrics_extracted_count": int((parsed_error or {}).get("metrics_extracted_count", 0)),
                            "missing_required_metrics": (parsed_error or {}).get(
                                "missing_required_metrics",
                                [
                                    "balance_sheet.total_assets",
                                    "balance_sheet.total_liabilities",
                                    "balance_sheet.total_equity",
                                    "income_statement.revenue_or_interest_income",
                                    "income_statement.net_profit",
                                ],
                            ),
                            "quality_issues": (parsed_error or {}).get("quality_issues", []),
                            "re_extraction_attempts": int((parsed_error or {}).get("re_extraction_attempts", 1) or 1),
                            "dual_pass": (parsed_error or {}).get("dual_pass", {}),
                            "critical_values": (parsed_error or {}).get("critical_values", {}),
                        }
                    )

        extraction_outputs = [
            extraction_outputs_by_path[p]
            for p in input_paths
            if p in extraction_outputs_by_path
        ]

        if not extraction_outputs:
            missing_union: set[str] = set()
            years_detected: set[int] = set()
            metrics_extracted_total = 0
            for item in file_errors:
                metrics_extracted_total += int(item.get("metrics_extracted_count", 0) or 0)
                for missing in item.get("missing_required_metrics", []):
                    if isinstance(missing, str):
                        missing_union.add(missing)
                year = item.get("document_year")
                if isinstance(year, int):
                    years_detected.add(year)
                for detected in item.get("detected_years", []):
                    if isinstance(detected, int):
                        years_detected.add(detected)

            failure_report = {
                "status": "extraction_failed",
                "report_id": request.report_id,
                "pdfs_processed": len(input_paths),
                "years_detected": sorted(years_detected),
                "metrics_extracted_count": metrics_extracted_total,
                "missing_required_metrics": sorted(missing_union),
                "document_errors": file_errors,
            }
            set_json(redis, f"report:{request.report_id}:extraction_failure", failure_report, cfg.redis_ttl_seconds)
            raise HTTPException(status_code=422, detail=failure_report)

        extraction_output = _to_canonical_line_items(extraction_outputs)
        payload = save_canonical_raw(
            redis, request.report_id, extraction_output, cfg.redis_ttl_seconds
        )

        years_detected = sorted(
            {
                int(item.get("document_year"))
                for item in extraction_outputs
                if isinstance(item.get("document_year"), int)
            }
        )
        coverage = {
            "pdfs_processed": len(input_paths),
            "valid_pdfs": len(extraction_outputs),
            "years_detected": years_detected,
            "metrics_extracted_count": int(
                sum(int(item.get("metrics_extracted_count", 0)) for item in extraction_outputs)
            ),
            "avg_extraction_confidence": (
                sum(float(item.get("extraction_confidence", 0.0)) for item in extraction_outputs) / len(extraction_outputs)
            ),
            "avg_extraction_agreement": (
                sum(float(((item.get("dual_pass") or {}).get("agreement_score", 0.0) or 0.0)) for item in extraction_outputs) / len(extraction_outputs)
            ),
            "avg_re_extraction_attempts": (
                sum(int(item.get("re_extraction_attempts", 1) or 1) for item in extraction_outputs) / len(extraction_outputs)
            ),
            "document_errors": file_errors,
        }
        set_json(redis, f"report:{request.report_id}:extraction_coverage", coverage, cfg.redis_ttl_seconds)
        mark_success(redis, request.report_id)
        return {
            "status": "completed",
            "report_id": request.report_id,
            "artifact": f"report:{request.report_id}:canonical_raw",
            "page_count": total_pages,
            "document_count": len(extraction_outputs),
            "document_errors": file_errors,
            "schema_version": payload.schema_version,
            "years_detected": years_detected,
            "coverage": coverage,
        }
    except Exception as exc:
        mark_failed(redis, request.report_id, str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "extraction-service"}
