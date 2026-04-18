from __future__ import annotations


def compute_confidence(
    issues: list,
    ratios: dict,
    kpis: dict,
    merged: dict | None = None,
    extraction_coverage: dict | None = None,
) -> dict:
    score = 0.20
    issue_penalty = min(len(issues) * 0.04, 0.30)

    latest_metrics = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        latest_metrics = ratios["by_year"].get(ratios["latest_year"], {})

    numeric_ratio_count = 0
    if isinstance(latest_metrics, dict):
        numeric_ratio_count = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])
    ratio_coverage = min(1.0, numeric_ratio_count / 20.0)

    years = ratios.get("detected_years") if isinstance(ratios.get("detected_years"), list) else []
    if not years and isinstance(merged, dict):
        years = merged.get("years") if isinstance(merged.get("years"), list) else []
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

    # Unit consistency component from merged per-year metadata.
    unit_consistency = 0.0
    if isinstance(merged, dict):
        financials = merged.get("financials") if isinstance(merged.get("financials"), dict) else {}
        currencies = {
            (financials.get(y, {}) or {}).get("currency")
            for y in merged.get("years", [])
            if (financials.get(y, {}) or {}).get("currency")
        }
        multipliers = {
            (financials.get(y, {}) or {}).get("unit_multiplier")
            for y in merged.get("years", [])
            if isinstance((financials.get(y, {}) or {}).get("unit_multiplier"), int)
        }
        unit_consistency = 1.0 if len(currencies) <= 1 and len(multipliers) <= 1 else 0.0

    # Multi-year continuity component from hard-validation gate result.
    continuity = 0.0
    if gates:
        continuity = 1.0 if bool(gates.get("gate_4_multi_year_continuity")) else 0.0

    # Re-extraction success proxy: lower retries imply higher confidence.
    re_extraction_success = 0.5
    if isinstance(extraction_coverage, dict):
        avg_attempts = float(extraction_coverage.get("avg_re_extraction_attempts", 1.0) or 1.0)
        re_extraction_success = max(0.0, min(1.0, 1.0 - ((avg_attempts - 1.0) / 3.0)))

    score += 0.20 * completeness
    score += 0.20 * validation_pass_rate
    score += 0.15 * unit_consistency
    score += 0.15 * continuity
    score += 0.15 * year_coverage
    score += 0.10 * re_extraction_success
    score += 0.05 * ratio_coverage
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
        "unit_consistency": unit_consistency,
        "multi_year_continuity": continuity,
        "re_extraction_success_rate": re_extraction_success,
    }
