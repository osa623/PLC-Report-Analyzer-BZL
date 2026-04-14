from __future__ import annotations


def compute_confidence(issues: list, ratios: dict[str, float], kpis: dict[str, float]) -> dict:
    score = 1.0
    score -= min(len(issues) * 0.1, 0.6)
    if not ratios:
        score -= 0.2
    if not kpis:
        score -= 0.2
    score = max(0.0, min(score, 1.0))
    return {
        "score": score,
        "band": "high" if score >= 0.8 else "medium" if score >= 0.6 else "low",
        "issue_count": len(issues),
    }
