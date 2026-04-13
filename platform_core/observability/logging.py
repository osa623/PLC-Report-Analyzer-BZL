from __future__ import annotations

import logging
from typing import Any


class _StructuredAdapter(logging.LoggerAdapter):
    def process(self, msg: str, kwargs: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        extras = {**self.extra, **kwargs.pop("extra", {})}
        prefix = " ".join(f"{k}={v}" for k, v in sorted(extras.items()))
        output = f"{prefix} | {msg}" if prefix else msg
        return output, kwargs


def get_structured_logger(name: str, **service_context: Any) -> logging.LoggerAdapter:
    logger = logging.getLogger(name)
    if not logger.handlers:
        logging.basicConfig(level=logging.INFO)
    return _StructuredAdapter(logger, service_context)
