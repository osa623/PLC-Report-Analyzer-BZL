import asyncio
import hashlib
import os
import logging
from typing import Dict, Any, List

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from .telemetry import DOCAI_CALLS, DOCAI_ERRORS, DOCAI_LATENCY
import time

try:
    import pybreaker
except Exception:
    pybreaker = None

# Circuit breaker for Document AI calls
if pybreaker is not None:
    DOCUMENTAI_BREAKER = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)
else:
    DOCUMENTAI_BREAKER = None

try:
    from google.cloud import documentai_v1 as documentai
except Exception:
    documentai = None

logger = logging.getLogger(__name__)


def compute_pdf_hash(pdf_bytes: bytes) -> str:
    return hashlib.sha256(pdf_bytes).hexdigest()


def _parse_document(document: "documentai.Document") -> Dict[str, Any]:
    # Lightweight parser: extract plain text and table placeholders
    pages: List[Dict[str, Any]] = []
    text = document.text or ""

    for page in document.pages:
        page_tables = []
        for table in page.tables:
            rows = []
            for r in table.header_rows + table.body_rows:
                cells = [
                    (
                        c.layout.text_anchor.content.strip()
                        if getattr(c.layout, "text_anchor", None)
                        else ""
                    )
                    for c in r.cells
                ]
                rows.append(cells)
            page_tables.append({"rows": rows})
        pages.append({"page_number": page.page_number, "tables": page_tables})

    entities = []
    for entity in getattr(document, "entities", []) or []:
        entities.append(
            {
                "type": entity.type_,
                "mention_text": entity.mention_text,
                "confidence": entity.confidence,
            }
        )

    structured = {
        "pages": pages,
        "tables_present": bool(pages and any(p["tables"] for p in pages)),
        "entities": entities,
    }
    return {"raw_text": text, "structured": structured}


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(Exception),
)
def _sync_process_document(pdf_bytes: bytes, processor_name: str) -> Dict[str, Any]:
    if documentai is None:
        raise RuntimeError("google-cloud-documentai is not installed or not available")

    DOCAI_CALLS.inc()
    start = time.time()
    client = documentai.DocumentProcessorServiceClient()
    # Processor resource name: projects/{project}/locations/{location}/processors/{processor}
    name = processor_name or os.environ.get("DOCUMENT_AI_PROCESSOR")
    if not name:
        raise ValueError(
            "Document AI processor name must be set via argument or DOCUMENT_AI_PROCESSOR env var"
        )

    document = documentai.Document()
    document.content = pdf_bytes
    document.mime_type = "application/pdf"

    request = documentai.ProcessRequest(name=name, raw_document=document)
    try:
        if DOCUMENTAI_BREAKER is not None:
            response = DOCUMENTAI_BREAKER.call(client.process_document, request=request)
        else:
            response = client.process_document(request=request)

        parsed = _parse_document(response.document)
        confidence = getattr(response.document, "confidence", None) or 0.0
        return {**parsed, "confidence": confidence, "processor": name}
    except Exception:
        DOCAI_ERRORS.inc()
        raise
    finally:
        DOCAI_LATENCY.observe(time.time() - start)


async def call_document_ai(
    pdf_bytes: bytes, processor_name: str = None
) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, _sync_process_document, pdf_bytes, processor_name
    )
    logger.info(
        "Document AI processed document, confidence=%s", result.get("confidence")
    )
    return result
