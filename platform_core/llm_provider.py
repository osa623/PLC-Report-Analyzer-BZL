import os
import asyncio
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("platform_core.llm_provider")


def _provider_name() -> str:
    return os.environ.get("LLM_PROVIDER") or os.environ.get("GEMINI_PROVIDER", "google")


async def call_llm(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    name = _provider_name().lower()
    if name in ("google", "gemini"):
        # lazy import to avoid hard dependency if not used
        from ..services.extraction_service.integrations.gemini_client import call_gemini

        return await call_gemini(prompt, max_output_tokens)
    elif name == "openai":
        from ..services.extraction_service.integrations.openai_client import call_openai

        return await call_openai(prompt, max_output_tokens)
    elif name == "anthropic":
        from ..services.extraction_service.integrations.anthropic_client import call_anthropic

        return await call_anthropic(prompt, max_output_tokens)
    else:
        raise RuntimeError(f"Unsupported LLM provider: {name}")


def call_llm_sync(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    return asyncio.get_event_loop().run_until_complete(call_llm(prompt, max_output_tokens))
