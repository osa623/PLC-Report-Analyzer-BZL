from __future__ import annotations


def extract(chunks: list[dict]) -> list[dict]:
    return [
        {"label": "Total Assets", "value": 0.0, "period": "current"},
        {"label": "Total Liabilities", "value": 0.0, "period": "current"},
        {"label": "Total Equity", "value": 0.0, "period": "current"},
    ]
