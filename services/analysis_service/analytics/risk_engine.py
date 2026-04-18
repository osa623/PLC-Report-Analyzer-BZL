from __future__ import annotations


def _score_from_threshold(value: float | None, low_is_risky: bool, warning: float, critical: float) -> tuple[float, str]:
    if value is None:
        return 0.4, "unknown"

    if low_is_risky:
        if value <= critical:
            return 0.9, "high"
        if value <= warning:
            return 0.6, "medium"
        return 0.2, "low"

    if value >= critical:
        return 0.9, "high"
    if value >= warning:
        return 0.6, "medium"
    return 0.2, "low"


def _category(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def compute_risk_signals(ratios: dict) -> dict:
    latest = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        latest = ratios["by_year"].get(ratios["latest_year"], ratios)

    profitability_score, profitability_level = _score_from_threshold(
        latest.get("net_margin"),
        low_is_risky=True,
        warning=0.06,
        critical=0.0,
    )
    liquidity_score, liquidity_level = _score_from_threshold(
        latest.get("current_ratio"),
        low_is_risky=True,
        warning=1.2,
        critical=1.0,
    )
    debt_score, debt_level = _score_from_threshold(
        latest.get("debt_to_equity"),
        low_is_risky=False,
        warning=1.5,
        critical=2.5,
    )
    cashflow_score, cashflow_level = _score_from_threshold(
        latest.get("operating_cashflow_to_net_profit"),
        low_is_risky=True,
        warning=0.8,
        critical=0.4,
    )

    growth_metrics = ratios.get("growth", {}) if isinstance(ratios.get("growth"), dict) else {}
    growth_value = growth_metrics.get("revenue_cagr")
    growth_stability_score, growth_stability_level = _score_from_threshold(
        growth_value,
        low_is_risky=True,
        warning=0.02,
        critical=-0.05,
    )

    red_flags = ratios.get("forensic_flags") if isinstance(ratios.get("forensic_flags"), list) else []
    accounting_flag_score = min(1.0, len(red_flags) / 5.0)
    accounting_flag_level = "high" if accounting_flag_score >= 0.7 else "medium" if accounting_flag_score >= 0.35 else "low"

    weighted_score_0_1 = (
        profitability_score * 0.20
        + liquidity_score * 0.15
        + debt_score * 0.20
        + cashflow_score * 0.20
        + growth_stability_score * 0.15
        + accounting_flag_score * 0.10
    )
    weighted_score_100 = round(weighted_score_0_1 * 100.0, 2)

    if weighted_score_100 <= 30:
        weighted_band = "low"
    elif weighted_score_100 <= 60:
        weighted_band = "moderate"
    else:
        weighted_band = "high"

    risk_scores = {
        "profitability_strength": profitability_score,
        "liquidity_strength": liquidity_score,
        "debt_risk": debt_score,
        "cashflow_health": cashflow_score,
        "growth_stability": growth_stability_score,
        "accounting_red_flags": accounting_flag_score,
    }
    risk_levels = {
        "profitability_strength": profitability_level,
        "liquidity_strength": liquidity_level,
        "debt_risk": debt_level,
        "cashflow_health": cashflow_level,
        "growth_stability": growth_stability_level,
        "accounting_red_flags": accounting_flag_level,
    }

    flags = [name for name, level in risk_levels.items() if level in {"high", "medium"}]
    known_coverage = len([v for v in risk_scores.values() if isinstance(v, (int, float))]) / max(1, len(risk_scores))

    return {
        "overall_risk_score": weighted_score_100,
        "overall_risk_level": weighted_band,
        "profitability_score": round((1.0 - profitability_score) * 100.0, 2),
        "liquidity_score": round((1.0 - liquidity_score) * 100.0, 2),
        "solvency_score": round((1.0 - debt_score) * 100.0, 2),
        "earnings_quality_score": round((1.0 - accounting_flag_score) * 100.0, 2),
        "growth_stability_score": round((1.0 - growth_stability_score) * 100.0, 2),
        "final_financial_health_score": round((1.0 - weighted_score_0_1) * 100.0, 2),
        "risk_scores": risk_scores,
        "risk_levels": risk_levels,
        "risk_flags": flags,
        "known_signal_coverage": known_coverage,
        "weighted_model": {
            "profitability_strength_weight": 0.20,
            "liquidity_strength_weight": 0.15,
            "debt_risk_weight": 0.20,
            "cashflow_health_weight": 0.20,
            "growth_stability_weight": 0.15,
            "accounting_red_flags_weight": 0.10,
            "classification": {
                "low_risk": "0-30",
                "moderate_risk": "31-60",
                "high_risk": "61-100",
            },
        },
        # Compatibility aliases for existing consumers.
        "risk_rating": weighted_band,
    }
