from __future__ import annotations


def build_chart_data(ratios: dict) -> dict:
    return {
        "ratio_chart": [{"metric": k, "value": v} for k, v in ratios.items()]
    }
