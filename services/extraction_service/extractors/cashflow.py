from __future__ import annotations


def extract(chunks: list[dict]) -> list[dict]:
    return [
        {"label": "Opening Cash", "value": 0.0, "period": "current"},
        {"label": "Net Cash Flow", "value": 0.0, "period": "current"},
        {"label": "Closing Cash", "value": 0.0, "period": "current"},
        {"label": "Net Income", "value": 0.0, "period": "current"},
    ]
