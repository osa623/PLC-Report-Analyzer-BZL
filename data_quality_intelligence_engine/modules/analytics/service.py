from __future__ import annotations

from typing import Any


def _safe_div(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or b == 0:
        return None
    return a / b


def _index_rows(validated_rows: list[dict[str, Any]]) -> dict[str, dict[str, dict[str, Any]]]:
    indexed: dict[str, dict[str, dict[str, Any]]] = {}
    for row in validated_rows:
        year = str(row.get("year") or "unknown")
        label = str(row.get("canonical_label") or "")
        indexed.setdefault(year, {})[label] = row
    return indexed


def calculate_ratios(validated_rows: list[dict[str, Any]], min_confidence: float) -> dict[str, Any]:
    indexed = _index_rows([r for r in validated_rows if float(r.get("confidence_score") or 0.0) >= min_confidence])
    metrics: list[dict[str, Any]] = []

    for year, labels in indexed.items():
        revenue = labels.get("revenue", {}).get("value")
        net_profit = labels.get("net_profit", {}).get("value")
        assets = labels.get("assets", {}).get("value")
        liabilities = labels.get("liabilities", {}).get("value")
        equity = labels.get("equity", {}).get("value")

        net_margin = _safe_div(net_profit, revenue)
        debt_to_equity = _safe_div(liabilities, equity)
        asset_turnover = _safe_div(revenue, assets)

        for name, value, refs in [
            ("net_margin", net_margin, [labels.get("net_profit", {}).get("row_id"), labels.get("revenue", {}).get("row_id")]),
            ("debt_to_equity", debt_to_equity, [labels.get("liabilities", {}).get("row_id"), labels.get("equity", {}).get("row_id")]),
            ("asset_turnover", asset_turnover, [labels.get("revenue", {}).get("row_id"), labels.get("assets", {}).get("row_id")]),
        ]:
            if value is None:
                continue
            metrics.append(
                {
                    "metric_or_pattern_name": name,
                    "year": year,
                    "value": value,
                    "confidence_score": 0.75,
                    "supporting_row_ids": [r for r in refs if r],
                    "notes": "calculated_from_validated_rows",
                }
            )

    return {"status": "completed", "metrics": metrics}


def sector_kpis(ratios_payload: dict[str, Any], sector: str | None) -> dict[str, Any]:
    benchmarks = {
        "net_margin": 0.12,
        "debt_to_equity": 1.2,
        "asset_turnover": 0.7,
    }
    out: list[dict[str, Any]] = []

    for item in ratios_payload.get("metrics", []):
        name = item.get("metric_or_pattern_name")
        value = item.get("value")
        benchmark = benchmarks.get(str(name))
        if benchmark is None or value is None:
            continue

        delta = float(value) - benchmark
        out.append(
            {
                "metric_or_pattern_name": name,
                "sector": sector or "unknown",
                "value": value,
                "benchmark": benchmark,
                "delta": delta,
                "classification": "above" if delta > 0 else "below",
                "confidence_score": item.get("confidence_score", 0.7),
                "supporting_row_ids": item.get("supporting_row_ids", []),
                "notes": "benchmark_comparison",
            }
        )

    return {"status": "completed", "kpis": out}


def detect_patterns(validated_rows: list[dict[str, Any]], min_confidence: float) -> dict[str, Any]:
    rows = [r for r in validated_rows if float(r.get("confidence_score") or 0.0) >= min_confidence]
    by_label: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_label.setdefault(str(row.get("canonical_label") or ""), []).append(row)

    patterns: list[dict[str, Any]] = []
    revenue_rows = sorted(by_label.get("revenue", []), key=lambda r: str(r.get("year")))
    if len(revenue_rows) >= 2:
        first = float(revenue_rows[0].get("value") or 0.0)
        last = float(revenue_rows[-1].get("value") or 0.0)
        if first != 0:
            growth = (last - first) / abs(first)
            patterns.append(
                {
                    "metric_or_pattern_name": "revenue_trend",
                    "value": growth,
                    "confidence_score": 0.74,
                    "supporting_row_ids": [revenue_rows[0].get("row_id"), revenue_rows[-1].get("row_id")],
                    "notes": "multi_year_growth_signal",
                }
            )

    return {"status": "completed", "patterns": patterns}
