from __future__ import annotations


def compute_confidence(issues: list, ratios: dict[str, float], kpis: dict[str, float]) -> dict:
    # Base quality starts conservative and rises with evidence completeness.
    score = 0.35
    issue_penalty = min(len(issues) * 0.08, 0.5)

    latest_metrics = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        latest_metrics = ratios["by_year"].get(ratios["latest_year"], {})

    numeric_ratio_count = 0
    if isinstance(latest_metrics, dict):
        numeric_ratio_count = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])
    ratio_coverage = min(1.0, numeric_ratio_count / 20.0)

    years = ratios.get("detected_years") if isinstance(ratios.get("detected_years"), list) else []
    numeric_years = [y for y in years if isinstance(y, str) and y.isdigit()]
    year_coverage = min(1.0, len(numeric_years) / 3.0)

    hard_validation = {}
    gating = ratios.get("gating") if isinstance(ratios.get("gating"), dict) else {}
    if isinstance(gating.get("hard_validation"), dict):
        hard_validation = gating.get("hard_validation")
    gates = hard_validation.get("gates") if isinstance(hard_validation.get("gates"), dict) else {}
    validation_pass_rate = 0.0
    if gates:
        validation_pass_rate = sum(1 for v in gates.values() if bool(v)) / float(len(gates))

    # Statement completeness proxy from required fields represented in ratio output.
    required_keys = [
        "gross_margin",
        "operating_margin",
        "net_margin",
        "current_ratio",
        "debt_to_equity",
        "operating_cashflow_to_net_profit",
    ]
    completeness = 0.0
    if isinstance(latest_metrics, dict):
        completeness = sum(1 for key in required_keys if isinstance(latest_metrics.get(key), (int, float))) / float(len(required_keys))

    score += 0.20 * ratio_coverage
    score += 0.20 * year_coverage
    score += 0.20 * completeness
    score += 0.25 * validation_pass_rate
    score -= issue_penalty

    if not ratios:
        score -= 0.1
    if not kpis:
        score -= 0.1

    score = max(0.0, min(score, 1.0))

    coverage_ratio = ratio_coverage
    return {
        "score": score,
        "band": "high" if score >= 0.8 else "medium" if score >= 0.6 else "low",
        "issue_count": len(issues),
        "numeric_ratio_count": numeric_ratio_count,
        "ratio_coverage": coverage_ratio,
        "validation_pass_rate": validation_pass_rate,
        "statement_completeness": completeness,
        "year_coverage": year_coverage,
    }
