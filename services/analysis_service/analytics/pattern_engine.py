from __future__ import annotations

from platform_core.contracts.canonical_dataset import ValidationIssue


def _numeric_years(ratios: dict) -> list[str]:
    years = ratios.get("detected_years") if isinstance(ratios, dict) else []
    if not isinstance(years, list):
        return []
    return sorted([y for y in years if isinstance(y, str) and y.isdigit()])


def _trend_flag(metric: str, by_year: dict[str, dict]) -> str | None:
    points: list[tuple[str, float]] = []
    for year in sorted(by_year.keys()):
        value = by_year.get(year, {}).get(metric)
        if isinstance(value, (int, float)):
            points.append((year, float(value)))
    if len(points) < 3:
        return None

    deltas = [points[i][1] - points[i - 1][1] for i in range(1, len(points))]
    if all(d > 0 for d in deltas):
        return f"{metric} upward trend"
    if all(d < 0 for d in deltas):
        return f"{metric} downward trend"
    if any(abs(d) > 0.1 for d in deltas):
        return f"{metric} volatile trend"
    return f"{metric} structurally stable"


def compute_patterns(validated, issues: list[ValidationIssue], ratios: dict | None = None) -> list[str]:
    patterns: list[str] = []
    if issues:
        patterns.append("Validation friction detected")
    if validated.reextraction_required:
        patterns.append("Re-extraction recommended")

    ratios = ratios or {}
    by_year = ratios.get("by_year") if isinstance(ratios.get("by_year"), dict) else {}
    numeric_years = _numeric_years(ratios)

    if len(numeric_years) >= 3:
        for metric in ("net_margin", "current_ratio", "debt_ratio"):
            flag = _trend_flag(metric, by_year)
            if flag:
                patterns.append(flag)
        # Multi-year growth/cycle diagnosis.
        rev_points = []
        for year in sorted(by_year.keys()):
            value = by_year.get(year, {}).get("revenue_growth_yoy")
            if isinstance(value, (int, float)):
                rev_points.append(float(value))
        if rev_points:
            if all(v > 0 for v in rev_points):
                patterns.append("Consistent multi-year growth pattern detected")
            elif all(v <= 0 for v in rev_points):
                patterns.append("Persistent top-line contraction pattern detected")
            elif any(v > 0 for v in rev_points) and any(v < 0 for v in rev_points):
                patterns.append("Cyclical revenue behavior detected")

        margin_points = []
        for year in sorted(by_year.keys()):
            value = by_year.get(year, {}).get("net_margin")
            if isinstance(value, (int, float)):
                margin_points.append(float(value))
        if len(margin_points) >= 3:
            if margin_points[-1] > margin_points[0]:
                patterns.append("Margin expansion trend observed")
            elif margin_points[-1] < margin_points[0]:
                patterns.append("Margin compression trend observed")

        debt_points = []
        for year in sorted(by_year.keys()):
            value = by_year.get(year, {}).get("debt_to_equity")
            if isinstance(value, (int, float)):
                debt_points.append(float(value))
        if len(debt_points) >= 3 and debt_points[-1] > debt_points[0]:
            patterns.append("Rising debt dependency pattern detected")

        # Stage 7 forensic pattern checks.
        years = sorted(by_year.keys())
        if len(years) >= 2:
            prev = by_year.get(years[-2], {}) if isinstance(by_year.get(years[-2]), dict) else {}
            latest = by_year.get(years[-1], {}) if isinstance(by_year.get(years[-1]), dict) else {}

            prev_profit = prev.get("net_margin")
            latest_profit = latest.get("net_margin")
            prev_ocf_np = prev.get("operating_cashflow_to_net_profit")
            latest_ocf_np = latest.get("operating_cashflow_to_net_profit")
            if all(isinstance(v, (int, float)) for v in [prev_profit, latest_profit, prev_ocf_np, latest_ocf_np]):
                if float(latest_profit) > float(prev_profit) and float(latest_ocf_np) < float(prev_ocf_np):
                    patterns.append("Profit rising while cash conversion is weakening")

            prev_asset_turnover = prev.get("asset_turnover")
            latest_asset_turnover = latest.get("asset_turnover")
            prev_rev_growth = prev.get("revenue_growth_yoy")
            latest_rev_growth = latest.get("revenue_growth_yoy")
            if all(isinstance(v, (int, float)) for v in [prev_asset_turnover, latest_asset_turnover, prev_rev_growth, latest_rev_growth]):
                if float(latest_rev_growth) > float(prev_rev_growth) and float(latest_asset_turnover) > float(prev_asset_turnover):
                    patterns.append("Revenue acceleration with improved asset productivity")

            prev_de = prev.get("debt_to_equity")
            latest_de = latest.get("debt_to_equity")
            if all(isinstance(v, (int, float)) for v in [prev_de, latest_de, prev_rev_growth, latest_rev_growth]):
                if float(latest_de) > float(prev_de) and float(latest_rev_growth) <= float(prev_rev_growth):
                    patterns.append("Debt rising faster than revenue momentum")

        # Volatility spike marker from growth series.
        growth_points = [
            float(by_year.get(y, {}).get("revenue_growth_yoy"))
            for y in years
            if isinstance(by_year.get(y, {}).get("revenue_growth_yoy"), (int, float))
        ]
        if len(growth_points) >= 3:
            span = max(growth_points) - min(growth_points)
            if span > 0.8:
                patterns.append("Volatility spike detected in revenue growth trajectory")
    else:
        if len(numeric_years) <= 1:
            patterns.append("Trend analysis limited due to single reporting year")
            patterns.append("Multi-year pattern detection not available for current dataset")
        else:
            patterns.append("Long-horizon trend detection limited because fewer than three reporting years are available")
        patterns.append("Structural financial snapshot generated from available periods")
        patterns.append("Risk interpretation generated from available ratio coverage")

    forensic = ratios.get("forensic_flags") if isinstance(ratios, dict) else None
    if isinstance(forensic, list):
        for item in forensic:
            if isinstance(item, str):
                patterns.append(item)

    if not patterns:
        patterns.append("Stable reporting pattern")
    return patterns
