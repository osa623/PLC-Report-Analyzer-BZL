import asyncio
import logging
import os
from typing import Dict, Any
from urllib import request, parse
from pathlib import Path

import json

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from .telemetry import GEMINI_CALLS, GEMINI_LATENCY
import time

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv(dotenv_path=Path(__file__).resolve().parents[3] / ".env", override=False)
try:
    import pybreaker
except Exception:
    pybreaker = None

# Circuit breaker for Gemini calls
if pybreaker is not None:
    GEMINI_BREAKER = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=60)
else:
    GEMINI_BREAKER = None


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
)
def _sync_call_gemini(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    GEMINI_CALLS.inc()
    start = time.time()
    provider = os.environ.get("LLM_PROVIDER") or os.environ.get("GEMINI_PROVIDER", "google")
    if provider == "gemini":
        provider = "google"
    if provider == "local" and os.environ.get("GOOGLE_API_KEY"):
        provider = "google"
    if provider != "google":
        raise NotImplementedError(
            "Only 'google' provider implemented for gemini_client"
        )

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is required for Gemini extraction")

    model = os.environ.get("LLM_MODEL", "gemini-2.0-flash")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    url = f"{endpoint}?{parse.urlencode({'key': api_key})}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": int(max_output_tokens),
            "responseMimeType": "application/json",
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ],
    }
    body = json.dumps(payload).encode("utf-8")

    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )

    try:
        timeout = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "90"))
        if "pybreaker" in globals() and GEMINI_BREAKER is not None:
            with GEMINI_BREAKER.call(request.urlopen, req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
        else:
            with request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
    finally:
        GEMINI_LATENCY.observe(time.time() - start)

    parsed: Dict[str, Any]
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = {"raw": raw}

    text = ""
    candidates = parsed.get("candidates") if isinstance(parsed, dict) else None
    if isinstance(candidates, list) and candidates:
        finish_reason = candidates[0].get("finishReason")
        if finish_reason and finish_reason not in ("STOP", "MAX_TOKENS"):
            logger.warning("Gemini returned finishReason=%s", finish_reason)
        parts = (
            candidates[0]
            .get("content", {})
            .get("parts", [])
        )
        if isinstance(parts, list):
            text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))

    return {"text": text, "raw": parsed}


async def call_gemini(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, _sync_call_gemini, prompt, max_output_tokens
    )
    logger.info("Gemini call completed; output length=%s", len(result.get("text", "")))
    return result
