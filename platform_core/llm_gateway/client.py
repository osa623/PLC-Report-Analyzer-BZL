from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class LLMGatewayConfig:
    primary_model: str = "gemini-2.0-flash"
    fallback_models: list[str] = field(default_factory=lambda: ["gemini-1.5-flash"])
    retry_count: int = 2
    backoff_base_seconds: float = 0.4
    prompt_registry: dict[str, str] = field(default_factory=dict)
    enforce_json_output: bool = True
    cost_per_1k_tokens_usd: float = 0.00035


@dataclass
class LLMCallResult:
    payload: dict[str, Any]
    model: str
    latency_ms: int
    tokens_in: int
    tokens_out: int
    cost_estimate_usd: float
    attempts: int


class LLMGateway:
    """Single LLM entry point with retry/fallback behavior and structured outputs."""

    def __init__(self, config: LLMGatewayConfig) -> None:
        self.config = config

    def invoke(
        self,
        prompt_key: str,
        context: dict[str, Any],
        call_fn: Callable[[str, str, int], str] | None = None,
    ) -> LLMCallResult:
        if prompt_key not in self.config.prompt_registry:
            raise ValueError(f"unknown_prompt_key:{prompt_key}")

        prompt_template = self.config.prompt_registry[prompt_key]
        prompt = prompt_template.format(**context)

        models = [self.config.primary_model, *self.config.fallback_models]
        last_error: Exception | None = None

        for model in models:
            for attempt in range(1, self.config.retry_count + 2):
                started = time.perf_counter()
                try:
                    raw = self._call_model(model, prompt, attempt, call_fn)
                    payload = self._parse_payload(raw)
                    latency_ms = int((time.perf_counter() - started) * 1000)

                    tokens_in = max(1, len(prompt) // 4)
                    tokens_out = max(1, len(raw) // 4)
                    cost = ((tokens_in + tokens_out) / 1000.0) * self.config.cost_per_1k_tokens_usd

                    return LLMCallResult(
                        payload=payload,
                        model=model,
                        latency_ms=latency_ms,
                        tokens_in=tokens_in,
                        tokens_out=tokens_out,
                        cost_estimate_usd=round(cost, 8),
                        attempts=attempt,
                    )
                except Exception as exc:  # pragma: no cover - behavior depends on provider
                    last_error = exc
                    if attempt <= self.config.retry_count:
                        time.sleep(self.config.backoff_base_seconds * (2 ** (attempt - 1)))

        raise RuntimeError(f"llm_gateway_failed:{last_error}")

    def _call_model(
        self,
        model: str,
        prompt: str,
        attempt: int,
        call_fn: Callable[[str, str, int], str] | None,
    ) -> str:
        if call_fn is not None:
            return call_fn(model, prompt, attempt)

        # Default deterministic mock behavior used for local development.
        return json.dumps({"model": model, "attempt": attempt, "data": None})

    def _parse_payload(self, raw: str) -> dict[str, Any]:
        if not self.config.enforce_json_output:
            return {"raw": raw}

        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("llm_output_must_be_json_object")
        return parsed
