import os
import json
import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger("openai_client")


async def call_openai(prompt: str, max_output_tokens: int = 1024) -> Dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("LLM_MODEL", "gpt-4o")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_output_tokens,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()
