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
