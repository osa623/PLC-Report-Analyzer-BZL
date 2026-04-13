from __future__ import annotations


def passes_quality_gate(overall_data_quality_score: float | None, threshold: float) -> bool:
    if overall_data_quality_score is None:
        return False
    return float(overall_data_quality_score) >= float(threshold)
