from __future__ import annotations


def compute_confidence(issues: list, ratios: dict[str, float], kpis: dict[str, float]) -> dict:
    score = 1.0
    score -= min(len(issues) * 0.1, 0.6)

    latest_metrics = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        latest_metrics = ratios["by_year"].get(ratios["latest_year"], {})

    numeric_ratio_count = 0
    if isinstance(latest_metrics, dict):
        numeric_ratio_count = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])

    # Penalize sparse extractable finance signal even if ratio envelope exists.
    if numeric_ratio_count == 0:
        score -= 0.45
    elif numeric_ratio_count < 4:
        score -= 0.25

    if not ratios:
        score -= 0.1
    if not kpis:
        score -= 0.1

    score = max(0.0, min(score, 1.0))

    coverage_ratio = min(1.0, numeric_ratio_count / 8.0)
    return {
        "score": score,
        "band": "high" if score >= 0.8 else "medium" if score >= 0.6 else "low",
        "issue_count": len(issues),
        "numeric_ratio_count": numeric_ratio_count,
        "ratio_coverage": coverage_ratio,
    }
