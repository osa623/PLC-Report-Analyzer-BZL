import asyncio
import json
import time
from typing import Dict, Any
from .integrations.document_ai_client import call_document_ai, compute_pdf_hash
from .integrations.textract_client import call_textract
from .integrations.gemini_normalizer import call_gemini_normalizer
from .integrations.cache import get_cached, set_cached
from .integrations.telemetry import PIPELINE_DURATION, CACHE_HITS, CACHE_MISSES

OCR_CONFIDENCE_THRESHOLD = 0.94


async def _merge_ocr_results(
    primary: Dict[str, Any], fallback: Dict[str, Any]
) -> Dict[str, Any]:
    # Basic merge strategy: prefer fields from primary if confidence high;
    # otherwise use fallback; keep both raw_texts for auditing.
    merged = {
        "raw_texts": {
            "primary": primary.get("raw_text"),
            "fallback": fallback.get("raw_text"),
        },
        "structured": primary.get("structured") or fallback.get("structured"),
        "confidence": max(
            primary.get("confidence", 0.0), fallback.get("confidence", 0.0)
        ),
        "sources": {
            "primary": primary.get("processor") or primary.get("engine"),
            "fallback": fallback.get("engine"),
        },
    }
    return merged


async def extract_pdf_to_structured(
    json_output_path: str, pdf_bytes: bytes
) -> Dict[str, Any]:
    start_pipeline = time.time()
    key = compute_pdf_hash(pdf_bytes)
    cached = await get_cached(key)
    if cached:
        try:
            CACHE_HITS.inc()
            return json.loads(cached)
        except Exception:
            CACHE_MISSES.inc()

    CACHE_MISSES.inc()

    # Step 1: call Document AI
    primary = await call_document_ai(pdf_bytes)

    # Step 2: fallback if confidence low
    if primary.get("confidence", 0.0) < OCR_CONFIDENCE_THRESHOLD:
        fallback = await call_textract(pdf_bytes)
    else:
        fallback = {
            "raw_text": None,
            "structured": None,
            "confidence": 0.0,
            "engine": None,
        }

    merged = await _merge_ocr_results(primary, fallback)

    # Step 3: Gemini normalization (table alignment, semantic labels)
    gemini_resp = await call_gemini_normalizer(merged.get("structured") or {})
    normalized = gemini_resp.get("normalized")
    # Run domain extractors on normalized JSON
    try:
        from .extractors.cashflow import extract as extract_cashflow

        cashflow_results = extract_cashflow(
            {"cash_flow": normalized.get("cash_flow", {})}
        )
    except Exception:
        cashflow_results = None

    final = {
        "document_hash": key,
        "ocr": merged,
        "normalized": normalized,
        "extracted": {
            "cashflow": cashflow_results,
        },
        "meta": {
            "gemini": gemini_resp.get("meta"),
            "final_confidence": min(
                1.0,
                merged.get("confidence", 0.0)
                * gemini_resp.get("normalized", {}).get("confidence", 1.0),
            ),
        },
    }

    # Cache final JSON
    try:
        await set_cached(key, json.dumps(final).encode("utf-8"), ttl=60 * 60 * 24)
    except Exception:
        pass

    # Optional: persist to file path for debugging
    try:
        with open(json_output_path, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=2)
    except Exception:
        pass

    PIPELINE_DURATION.observe(time.time() - start_pipeline)
    return final


if __name__ == "__main__":
    import sys

    async def _main():
        if len(sys.argv) < 3:
            print("Usage: orchestrator.py <pdf-file> <output-json>")
            return
        path = sys.argv[1]
        out = sys.argv[2]
        with open(path, "rb") as f:
            b = f.read()
        # Start Prometheus metrics server (non-blocking)
        try:
            import os

            from .integrations.telemetry import start_metrics_server

            start_metrics_server(port=int(os.environ.get("METRICS_PORT", 8000)))
        except Exception:
            pass

        res = await extract_pdf_to_structured(out, b)
        print("Extracted:", res.get("document_hash"))

    asyncio.run(_main())
