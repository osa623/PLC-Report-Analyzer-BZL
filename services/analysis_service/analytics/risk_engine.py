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

    liquidity_score, liquidity_level = _score_from_threshold(
        latest.get("current_ratio"),
        low_is_risky=True,
        warning=1.2,
        critical=1.0,
    )
    leverage_score, leverage_level = _score_from_threshold(
        latest.get("debt_to_equity"),
        low_is_risky=False,
        warning=1.5,
        critical=2.5,
    )
    profitability_score, profitability_level = _score_from_threshold(
        latest.get("net_margin"),
        low_is_risky=True,
        warning=0.05,
        critical=0.0,
    )
    cashflow_score, cashflow_level = _score_from_threshold(
        latest.get("operating_cashflow_to_current_liabilities"),
        low_is_risky=True,
        warning=0.2,
        critical=0.05,
    )

    growth_metrics = ratios.get("growth", {}) if isinstance(ratios.get("growth"), dict) else {}
    growth_value = growth_metrics.get("revenue_cagr")
    growth_score, growth_level = _score_from_threshold(
        growth_value,
        low_is_risky=True,
        warning=0.02,
        critical=-0.05,
    )

    concentration_score = 0.4
    concentration_level = "unknown"

    risk_scores = {
        "liquidity_risk": liquidity_score,
        "leverage_risk": leverage_score,
        "profitability_risk": profitability_score,
        "cashflow_risk": cashflow_score,
        "concentration_risk": concentration_score,
        "growth_sustainability_risk": growth_score,
    }
    risk_levels = {
        "liquidity_risk": liquidity_level,
        "leverage_risk": leverage_level,
        "profitability_risk": profitability_level,
        "cashflow_risk": cashflow_level,
        "concentration_risk": concentration_level,
        "growth_sustainability_risk": growth_level,
    }

    known_scores = [risk_scores[name] for name, level in risk_levels.items() if level != "unknown"]
    overall_score = sum(risk_scores.values()) / len(risk_scores)
    known_coverage = len(known_scores) / len(risk_scores)
    flags = [name for name, level in risk_levels.items() if level in {"high", "medium"}]

    return {
        "overall_risk_score": overall_score,
        "overall_risk_level": _category(sum(known_scores) / len(known_scores)) if known_scores else "unknown",
        "risk_scores": risk_scores,
        "risk_levels": risk_levels,
        "risk_flags": flags,
        "known_signal_coverage": known_coverage,
    }
