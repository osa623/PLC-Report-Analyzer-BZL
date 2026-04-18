#!/usr/bin/env python3
"""Run extraction on the repository's golden PDF reports and produce a results summary.

Usage:
  python scripts/run_golden_benchmark.py

Outputs written to `data/eval/golden_results/` and a summary `data/eval/golden_benchmark_report.json`.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "services" / "data"
OUT_DIR = ROOT / "data" / "eval" / "golden_results"
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def _run_one(pdf_path: Path):
    out = OUT_DIR / f"{pdf_path.stem}.json"
    # import the orchestrator function
    # ensure repo root is on sys.path so imports work when running as script
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    # monkeypatch cache to avoid requiring a running Redis instance during local benchmark
    try:
        import importlib

        cache_mod = importlib.import_module("services.extraction_service.integrations.cache")

        async def _noop_get_cached(key: str):
            return None

        async def _noop_set_cached(key: str, value: bytes, ttl: int = 0):
            return None

        cache_mod.get_cached = _noop_get_cached
        cache_mod.set_cached = _noop_set_cached
    except Exception:
        # best-effort; continue
        pass

    # monkeypatch Document AI and Textract clients to avoid requiring cloud SDKs
    try:
        import importlib

        docai = importlib.import_module(
            "services.extraction_service.integrations.document_ai_client"
        )
        tex = importlib.import_module(
            "services.extraction_service.integrations.textract_client"
        )
        gem = importlib.import_module(
            "services.extraction_service.integrations.gemini_client"
        )

        async def _stub_docai(pdf_bytes: bytes, processor_name=None):
            # return an empty structured payload with low confidence so fallback may be used
            return {"raw_text": "", "structured": {}, "confidence": 0.0, "processor": None}

        async def _stub_textract(pdf_bytes: bytes):
            return {"raw_text": "", "structured": {}, "confidence": 0.0, "engine": "textract"}

        docai.call_document_ai = _stub_docai
        tex.call_textract = _stub_textract
        # stub gemini to return an empty normalized payload
        async def _stub_gemini(prompt: str, max_output_tokens: int = 1024):
            return {"text": "{\"income_statement\": {}, \"balance_sheet\": {}, \"cash_flow\": {}, \"confidence\": 0.0}", "raw": {}}

        gem.call_gemini = _stub_gemini
        # ensure any previously-imported orchestrator module is reloaded so it picks up our monkeypatches
        sys.modules.pop("services.extraction_service.orchestrator", None)
        sys.modules.pop("services.extraction_service.integrations.document_ai_client", None)
        sys.modules.pop("services.extraction_service.integrations.textract_client", None)
    except Exception:
        pass

    from services.extraction_service.orchestrator import extract_pdf_to_structured

    with open(pdf_path, "rb") as f:
        pdfb = f.read()

    res = await extract_pdf_to_structured(str(out), pdfb)
    return pdf_path.name, res


async def main():
    # discover pdfs
    pdfs = sorted([p for p in DATA_DIR.glob("*.pdf")])
    if not pdfs:
        print("No PDFs found in services/data/")
        return 1

    results = {}
    for p in pdfs:
        print("Processing", p.name)
        try:
            name, res = await _run_one(p)
            results[name] = {
                "ok": True,
                "document_hash": res.get("document_hash"),
                "has_normalized": bool(res.get("normalized")),
                "has_cashflow_extract": res.get("extracted", {}).get("cashflow") is not None,
                "meta": res.get("meta"),
            }
        except Exception as exc:
            results[p.name] = {"ok": False, "error": str(exc)}

    summary = {
        "total": len(pdfs),
        "results": results,
    }

    report_path = ROOT / "data" / "eval" / "golden_benchmark_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("Wrote report to", report_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
