import asyncio
import logging
import os
from typing import Any, Dict, Optional


from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .llm_provider import call_llm, call_llm_sync

logger = logging.getLogger("platform_core.llm_gateway")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8), retry=retry_if_exception_type(Exception))
def _sync_call(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    # Synchronous wrapper for callers that prefer blocking behavior
    return call_llm_sync(prompt, max_output_tokens)


async def call(prompt: str, max_output_tokens: int = 1024, compress: bool = True) -> Dict[str, Any]:
    # Input compression / trimming could be implemented here
    return await call_llm(prompt, max_output_tokens)


def summarize_for_model(data: Dict[str, Any], keys: Optional[list[str]] = None) -> str:
    # Create a compact, safe representation to send to Gemini
    if keys:
        subset = {k: data.get(k) for k in keys}
    else:
        subset = data
    # JSON-safe trimming
    import json

    return json.dumps(subset, separators=(',', ':'), ensure_ascii=False)
