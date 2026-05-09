from __future__ import annotations


REQUIRED_CHARTS: list[tuple[str, str, str]] = [
    ("revenue_trend", "Revenue Trend", "revenue"),
    ("net_income", "Net Income", "net_income"),
    ("gross_profit_margin", "Gross Profit Margin", "gross_profit_margin"),
    ("net_profit_margin", "Net Profit Margin", "net_profit_margin"),
    ("return_on_equity", "Return on Equity", "return_on_equity"),
    ("return_on_assets", "Return on Assets", "return_on_assets"),
    ("debt_to_equity", "Debt to Equity", "debt_to_equity"),
    ("current_ratio", "Current Ratio", "current_ratio"),
    ("total_assets", "Total Assets", "total_assets"),
    ("total_liabilities", "Total Liabilities", "total_liabilities"),
    ("total_equity", "Total Equity", "total_equity"),
    ("total_cash_flow", "Total Cash Flow", "total_cash_flow"),
]


def _sorted_years(ratios: dict) -> list[str]:
    detected = ratios.get("detected_years") if isinstance(ratios.get("detected_years"), list) else []
    detected_years = sorted({str(y) for y in detected if isinstance(y, str) and y.isdigit()}, key=lambda y: int(y))
    if detected_years:
        return detected_years

    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    return sorted([y for y in by_year.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y))


def _metric_value(year_metrics: dict, metric_key: str) -> float | None:
    value = year_metrics.get(metric_key)
    if metric_key == "net_income" and not isinstance(value, (int, float)):
        value = year_metrics.get("net_profit")
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_chart_data(ratios: dict) -> dict:
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    years = _sorted_years(ratios)
    if not years:
        raise ValueError("chart_data_pipeline_error: no detected chart years available")

    required_charts: list[dict] = []
    for chart_id, label, metric_key in REQUIRED_CHARTS:
        dataset = []
        for year in years:
            year_metrics = by_year.get(year) if isinstance(by_year.get(year), dict) else {}
            dataset.append(
                {
                    "year": year,
                    "value": _metric_value(year_metrics, metric_key),
                }
            )

        if not dataset:
            raise ValueError(f"chart_data_pipeline_error: empty dataset for {label}")

        required_charts.append(
            {
                "chart_id": chart_id,
                "label": label,
                "metric_key": metric_key,
                "dataset": dataset,
            }
        )

    ratio_source = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        ratio_source = ratios["by_year"].get(ratios["latest_year"], ratios)

    ratio_chart = [
        {"metric": k, "value": float(v)}
        for k, v in ratio_source.items()
        if isinstance(v, (int, float))
    ]

    trend_chart = [
        {
            "year": year,
            "net_profit_margin": _metric_value(by_year.get(year) if isinstance(by_year.get(year), dict) else {}, "net_profit_margin"),
            "current_ratio": _metric_value(by_year.get(year) if isinstance(by_year.get(year), dict) else {}, "current_ratio"),
            "debt_ratio": _metric_value(by_year.get(year) if isinstance(by_year.get(year), dict) else {}, "debt_ratio"),
        }
        for year in years
    ]

    return {
        "required_charts": required_charts,
        "ratio_chart": ratio_chart,
        "trend_chart": trend_chart,
    }
