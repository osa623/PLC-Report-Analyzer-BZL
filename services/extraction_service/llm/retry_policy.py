from __future__ import annotations

from typing import Callable


def with_retries(fn: Callable, attempts: int = 2):
    last_error = None
    for _ in range(attempts):
        try:
            return fn()
        except Exception as exc:  # pragma: no cover - protective fallback
            last_error = exc
    raise RuntimeError(f"Extraction retry failed: {last_error}")
