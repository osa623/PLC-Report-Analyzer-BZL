from __future__ import annotations


def build_chart_data(ratios: dict) -> dict:
    ratio_source = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        ratio_source = ratios["by_year"].get(ratios["latest_year"], ratios)

    ratio_chart = [
        {"metric": k, "value": float(v)}
        for k, v in ratio_source.items()
        if isinstance(v, (int, float))
    ]

    trend_chart = []
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    for year, year_metrics in by_year.items():
        if not isinstance(year_metrics, dict):
            continue
        point = {
            "year": year,
            "net_margin": year_metrics.get("net_margin"),
            "current_ratio": year_metrics.get("current_ratio"),
            "debt_ratio": year_metrics.get("debt_ratio"),
        }
        if any(isinstance(point[k], (int, float)) for k in ("net_margin", "current_ratio", "debt_ratio")):
            trend_chart.append(point)

    return {
        "ratio_chart": ratio_chart,
        "trend_chart": trend_chart,
    }
