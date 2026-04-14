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
from .telemetry import GEMINI_CALLS, GEMINI_LATENCY
import time

logger = logging.getLogger(__name__)
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
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(Exception),
)
def _sync_call_gemini(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    GEMINI_CALLS.inc()
    start = time.time()
    # Minimal, production-oriented placeholder for calling Gemini via Google Generative API.
    # Configure via environment variables: GEMINI_PROVIDER=google and GOOGLE_API_KEY or application default creds
    provider = os.environ.get("GEMINI_PROVIDER", "google")
    if provider != "google":
        raise NotImplementedError(
            "Only 'google' provider implemented for gemini_client"
        )

    try:
        # Import locally to avoid hard dependency at module import time
        import google.generativeai as genai
    except Exception:
        raise RuntimeError(
            "google.generativeai library is required for Gemini calls (install google-generative-ai)"
        )

    api_key = os.environ.get("GOOGLE_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)

    # Example call (synchronous)
    try:
        if "pybreaker" in globals() and GEMINI_BREAKER is not None:
            response = GEMINI_BREAKER.call(
                genai.generate_text,
                model="gemini-pro-1",
                prompt=prompt,
                max_output_tokens=max_output_tokens,
            )
        else:
            response = genai.generate_text(
                model="gemini-pro-1", prompt=prompt, max_output_tokens=max_output_tokens
            )
    finally:
        GEMINI_LATENCY.observe(time.time() - start)

    # Response parsing depends on model output format; expect JSON string or structured text
    return {"text": getattr(response, "text", str(response)), "raw": response}


async def call_gemini(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, _sync_call_gemini, prompt, max_output_tokens
    )
    logger.info("Gemini call completed; output length=%s", len(result.get("text", "")))
    return result
