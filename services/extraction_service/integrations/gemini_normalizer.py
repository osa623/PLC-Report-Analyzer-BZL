import hashlib
import json
import logging
from typing import Dict, Any

from .gemini_client import call_gemini
from .cache import get_cached, set_cached

logger = logging.getLogger(__name__)


def _compress_structured(
    structured: Dict[str, Any], max_tables: int = 5, max_rows: int = 30
) -> Dict[str, Any]:
    # Keep only the most relevant parts: tables and first N rows of each table
    compressed = {"tables": [], "pages": []}
    tables = structured.get("tables") or []
    # If tables are nested under pages, handle that
    if isinstance(structured.get("pages"), list):
        for p in structured.get("pages", []):
            p_tables = p.get("tables", [])[:max_tables]
            ct = []
            for t in p_tables:
                rows = t.get("rows", [])[:max_rows]
                ct.append({"rows": rows})
            if ct:
                compressed["tables"].append(
                    {"page": p.get("page_number"), "tables": ct}
                )
    else:
        for t in tables[:max_tables]:
            rows = t.get("rows", [])[:max_rows]
            compressed["tables"].append({"rows": rows})

    # Also include headline entities if present
    if structured.get("entities"):
        compressed["entities"] = structured.get("entities")[:50]

    return compressed


async def call_gemini_normalizer(
    structured_ocr: Dict[str, Any], prompts_version: str = "tables_v1"
) -> Dict[str, Any]:
    # Create a cache key based on the structured OCR content and prompt version
    fingerprint = hashlib.sha256(
        json.dumps(structured_ocr, sort_keys=True).encode("utf-8")
    ).hexdigest()
    cache_key = f"gemini:normalizer:{prompts_version}:{fingerprint}"

    cached = await get_cached(cache_key)
    if cached:
        try:
            payload = json.loads(cached)
            return payload
        except Exception:
            # fall through and re-generate
            logger.exception("Failed to parse cached gemini response; regenerating")

    compressed = _compress_structured(structured_ocr)

    # Build a strict prompt that asks Gemini to return JSON only with expected schema
    prompt = (
        "You are a table-and-section normalizer.\n"
        "Input: a compressed representation of detected tables and entities from OCR.\n"
        "Just identigy the extract year and under that values for each income , financial and cashflow statement line item. Do not hallucinate values that are not present in the input.\n"
        "Task: Extract and align financial statement tables into the following JSON schema:"
        ' {"income_statement": {...}, "balance_sheet": {...}, "cash_flow": {...}, "notes": [...], "sections": [...], "confidence": 0.0 }\n'
        "Rules:\n"
        "- Return JSON only, no explanatory text.\n"
        "- For tables, align columns into key:year:value maps when possible.\n"
        "- Provide per-field confidence between 0.0 and 1.0.\n"
        "- If a value is not present, use null.\n"
        "Input data (JSON):\n"
        f"{json.dumps(compressed)}\n"
        "Output JSON:"
    )

    try:
        resp = await call_gemini(prompt, max_output_tokens=2048)
    except Exception:
        logger.exception("Gemini normalizer call failed")
        normalized = {
            "income_statement": {},
            "balance_sheet": {},
            "cash_flow": {},
            "notes": [],
            "sections": [],
            "confidence": 0.0,
        }
        payload = {
            "normalized": normalized,
            "meta": {"model_role": "normalizer", "prompt_version": prompts_version},
        }
        await set_cached(cache_key, json.dumps(payload).encode("utf-8"))
        return payload

    text = resp.get("text") or resp.get("raw") or ""

    # Attempt to parse JSON from the model output
    normalized = None
    try:
        # Model may return text + JSON; find the first { and parse
        start = text.find("{")
        if start != -1:
            candidate = text[start:]
            normalized = json.loads(candidate)
    except Exception:
        logger.exception("Failed to parse Gemini JSON output")

    if not normalized:
        # fallback minimal structure
        normalized = {
            "income_statement": {},
            "balance_sheet": {},
            "cash_flow": {},
            "notes": [],
            "sections": [],
            "confidence": 0.0,
        }

    payload = {
        "normalized": normalized,
        "meta": {"model_role": "normalizer", "prompt_version": prompts_version},
    }

    # Cache the payload
    try:
        await set_cached(
            cache_key, json.dumps(payload).encode("utf-8"), ttl=60 * 60 * 24
        )
    except Exception:
        logger.exception("Failed to write gemini normalizer cache")

    return payload
