import asyncio
import logging
import os
from typing import Dict, Any

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from .telemetry import TEXTRACT_CALLS, TEXTRACT_ERRORS, TEXTRACT_LATENCY
import time

try:
    import pybreaker
except Exception:
    pybreaker = None

# Circuit breaker for Textract calls
if pybreaker is not None:
    TEXTRACT_BREAKER = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)
else:
    TEXTRACT_BREAKER = None

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except Exception:
    boto3 = None

logger = logging.getLogger(__name__)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
)
def _sync_call_textract(pdf_bytes: bytes) -> Dict[str, Any]:
    if boto3 is None:
        raise RuntimeError("boto3 is not installed or not available")
    TEXTRACT_CALLS.inc()
    start = time.time()
    client = boto3.client(
        "textract", region_name=os.environ.get("AWS_REGION", "us-east-1")
    )
    try:
        # Use AnalyzeDocument for synchronous table/form extraction from bytes
        if TEXTRACT_BREAKER is not None:
            resp = TEXTRACT_BREAKER.call(
                client.analyze_document,
                Document={"Bytes": pdf_bytes},
                FeatureTypes=["TABLES", "FORMS"],
            )
        else:
            resp = client.analyze_document(
                Document={"Bytes": pdf_bytes}, FeatureTypes=["TABLES", "FORMS"]
            )
    except (BotoCoreError, ClientError):
        TEXTRACT_ERRORS.inc()
        logger.exception("Textract call failed")
        raise
    finally:
        TEXTRACT_LATENCY.observe(time.time() - start)

    # Basic parse: collect blocks and tables
    blocks = resp.get("Blocks", [])
    text = []
    tables = []
    for b in blocks:
        if b.get("BlockType") == "LINE":
            text.append(b.get("Text"))
        if b.get("BlockType") == "TABLE":
            # collect table cells
            tables.append(b)

    structured = {"blocks_count": len(blocks), "tables_count": len(tables)}
    confidence = 0.0
    return {
        "raw_text": "\n".join(t for t in text if t),
        "structured": structured,
        "confidence": confidence,
        "engine": "textract",
    }


async def call_textract(pdf_bytes: bytes) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_call_textract, pdf_bytes)
