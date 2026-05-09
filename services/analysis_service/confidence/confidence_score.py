from __future__ import annotations


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _issue_weight(issue: object) -> float:
    if isinstance(issue, dict):
        severity = str(issue.get("severity", "warning")).lower()
        if severity == "error":
            return 1.0
        if severity == "info":
            return 0.3
    return 0.6


def compute_confidence(
    issues: list,
    ratios: dict,
    kpis: dict,
    merged: dict | None = None,
    extraction_coverage: dict | None = None,
) -> dict:
    latest_metrics = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        latest_metrics = ratios["by_year"].get(ratios["latest_year"], {})

    numeric_ratio_count = 0
    if isinstance(latest_metrics, dict):
        numeric_ratio_count = len([v for v in latest_metrics.values() if isinstance(v, (int, float))])

    expected_ratio_keys = [
        "gross_profit_margin",
        "net_profit_margin",
        "operating_margin",
        "current_ratio",
        "quick_ratio",
        "debt_to_equity",
        "debt_ratio",
        "interest_coverage",
        "return_on_equity",
        "return_on_assets",
        "asset_turnover",
        "cash_flow_to_net_income",
    ]
    ratio_coverage = _clamp01(numeric_ratio_count / float(len(expected_ratio_keys)))

    years = ratios.get("detected_years") if isinstance(ratios.get("detected_years"), list) else []
    if not years and isinstance(merged, dict):
        years = merged.get("years") if isinstance(merged.get("years"), list) else []
    numeric_years = [y for y in years if isinstance(y, str) and y.isdigit()]
    year_coverage = _clamp01(len(numeric_years) / 3.0)

    hard_validation = {}
    gating = ratios.get("gating") if isinstance(ratios.get("gating"), dict) else {}
    if isinstance(gating.get("hard_validation"), dict):
        hard_validation = gating.get("hard_validation")
    gates = hard_validation.get("gates") if isinstance(hard_validation.get("gates"), dict) else {}
    validation_pass_rate = 0.0
    hard_fail_count = 0
    if gates:
        validation_pass_rate = sum(1 for v in gates.values() if bool(v)) / float(len(gates))
        hard_fail_count = sum(1 for v in gates.values() if not bool(v))

    # Required core metrics contribute a completeness score.
    required_keys = [
        "gross_profit_margin",
        "net_profit_margin",
        "current_ratio",
        "debt_to_equity",
        "cash_flow_to_net_income",
    ]
    completeness = 0.0
    if isinstance(latest_metrics, dict):
        completeness = sum(1 for key in required_keys if isinstance(latest_metrics.get(key), (int, float))) / float(len(required_keys))

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

    continuity = 0.0
    if len(numeric_years) <= 1:
        continuity = 0.5
    elif len(numeric_years) >= 2:
        continuity = 0.75
    if gates:
        continuity = 1.0 if bool(gates.get("gate_4_multi_year_continuity")) else 0.0

    re_extraction_success = 0.5
    extraction_confidence_score = 0.0
    extraction_agreement_score = 0.0
    if isinstance(extraction_coverage, dict):
        avg_attempts = float(extraction_coverage.get("avg_re_extraction_attempts", 1.0) or 1.0)
        re_extraction_success = _clamp01(1.0 - ((avg_attempts - 1.0) / 3.0))
        extraction_confidence_score = _clamp01(float(extraction_coverage.get("avg_extraction_confidence", 0.0) or 0.0))
        extraction_agreement_score = _clamp01(float(extraction_coverage.get("avg_extraction_agreement", 0.0) or 0.0))

    weighted_issue_count = sum(_issue_weight(issue) for issue in issues)
    evidence_volume = max(1.0, float(numeric_ratio_count + len(required_keys) + len(gates)))
    issue_density_penalty = min(0.35, weighted_issue_count / evidence_volume)
    hard_fail_penalty = min(0.40, hard_fail_count * 0.12)

    # Evidence-based confidence: combine coverage/consistency/re-extraction quality and subtract penalties.
    evidence_score = 0.0
    evidence_score += 0.24 * validation_pass_rate
    evidence_score += 0.18 * completeness
    evidence_score += 0.14 * ratio_coverage
    evidence_score += 0.10 * year_coverage
    evidence_score += 0.08 * unit_consistency
    evidence_score += 0.08 * continuity
    evidence_score += 0.07 * re_extraction_success
    evidence_score += 0.06 * extraction_confidence_score
    evidence_score += 0.05 * extraction_agreement_score

    if not ratios:
        evidence_score -= 0.10
    if not kpis:
        evidence_score -= 0.08

    raw_score = _clamp01(evidence_score - issue_density_penalty - hard_fail_penalty)
    score = raw_score
    coverage_ratio = ratio_coverage

    return {
        "score": score,
        "raw_score": raw_score,
        "band": "high" if score >= 0.8 else "medium" if score >= 0.6 else "low",
        "raw_band": "high" if raw_score >= 0.8 else "medium" if raw_score >= 0.6 else "low",
        "policy_floor_applied": False,
        "issue_count": len(issues),
        "numeric_ratio_count": numeric_ratio_count,
        "ratio_coverage": coverage_ratio,
        "validation_pass_rate": validation_pass_rate,
        "hard_fail_count": hard_fail_count,
        "statement_completeness": completeness,
        "year_coverage": year_coverage,
        "unit_consistency": unit_consistency,
        "multi_year_continuity": continuity,
        "re_extraction_success_rate": re_extraction_success,
        "extraction_confidence_component": extraction_confidence_score,
        "extraction_agreement_component": extraction_agreement_score,
        "issue_density_penalty": issue_density_penalty,
        "hard_fail_penalty": hard_fail_penalty,
        "evidence_score": _clamp01(evidence_score),
    }
