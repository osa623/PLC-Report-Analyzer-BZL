from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from modules.financial_extractors.service import run_financial_extractors
from modules.narrative_extractors.service import run_narrative_extractors
from modules.parsing.service import parse_document
from modules.schema_validation.service import enforce_row_schema
from modules.structure.service import detect_structure
from modules.worker_pool.service import run_parallel


def run_extraction_pipeline(
    report_id: str,
    file_path: str,
    redis_client: Any,
    ttl_seconds: int,
    max_workers: int,
) -> dict[str, Any]:
    chunks = parse_document(file_path)
    structure = detect_structure(chunks)

    parallel_results = run_parallel(
        [
            ("financial", lambda: run_financial_extractors(chunks)),
            ("narrative", lambda: run_narrative_extractors(chunks)),
        ],
        max_workers=max_workers,
    )

    financial = parallel_results.get("financial", {}) or {}
    narrative = parallel_results.get("narrative", {}) or {}

    income_rows = enforce_row_schema(financial.get("income_statement", []), "income_statement")
    balance_rows = enforce_row_schema(financial.get("balance_sheet", []), "balance_sheet")
    cashflow_rows = enforce_row_schema(financial.get("cashflow_statement", []), "cashflow_statement")
    notes_rows = enforce_row_schema(financial.get("income_notes", []), "income_notes")
    segment_rows = enforce_row_schema(financial.get("segments", []), "segments")

    generated_at = datetime.now(timezone.utc).isoformat()

    document_chunks_payload = {
        "report_id": report_id,
        "generated_at": generated_at,
        "chunks": chunks,
    }
    structure_payload = {
        "report_id": report_id,
        "generated_at": generated_at,
        **structure,
    }
    base_payload = {
        "report_id": report_id,
        "generated_at": generated_at,
        "schema_version": "v1",
        "income_statement": income_rows,
        "balance_sheet": balance_rows,
        "cashflow_statement": cashflow_rows,
        "income_notes": notes_rows,
        "segments": segment_rows,
    }

    redis_client.setex(f"report:{report_id}:document_chunks", ttl_seconds, json.dumps(document_chunks_payload, ensure_ascii=True))
    redis_client.setex(f"report:{report_id}:structure", ttl_seconds, json.dumps(structure_payload, ensure_ascii=True))
    redis_client.setex(f"report:{report_id}", ttl_seconds, json.dumps(base_payload, ensure_ascii=True))

    for key in ["governance", "risk", "esg", "strategy"]:
        narrative_payload = narrative.get(key) or {"items": [], "count": 0}
        payload = {
            "report_id": report_id,
            "generated_at": generated_at,
            "schema_version": "v1",
            **narrative_payload,
        }
        redis_client.setex(f"report:{report_id}:{key}", ttl_seconds, json.dumps(payload, ensure_ascii=True))

    return {
        "status": "completed",
        "report_id": report_id,
        "chunk_count": len(chunks),
        "income_rows": len(income_rows),
        "balance_rows": len(balance_rows),
        "cashflow_rows": len(cashflow_rows),
        "notes_rows": len(notes_rows),
        "segment_rows": len(segment_rows),
        "governance_items": len((narrative.get("governance") or {}).get("items", [])),
        "risk_items": len((narrative.get("risk") or {}).get("items", [])),
        "esg_items": len((narrative.get("esg") or {}).get("items", [])),
        "strategy_items": len((narrative.get("strategy") or {}).get("items", [])),
    }
