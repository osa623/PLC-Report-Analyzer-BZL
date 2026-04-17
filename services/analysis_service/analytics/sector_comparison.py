from __future__ import annotations


def compare_sector(ratios: dict) -> dict:
    ratio_source = ratios
    if isinstance(ratios.get("latest_year"), str) and isinstance(ratios.get("by_year"), dict):
        ratio_source = ratios["by_year"].get(ratios["latest_year"], ratios)

    benchmarks = {"current_ratio": 1.5, "debt_to_assets": 0.55, "return_on_assets": 0.08}
    deltas = {k: float(ratio_source.get(k, 0.0) or 0.0) - benchmarks[k] for k in benchmarks}
    return {"benchmarks": benchmarks, "delta": deltas}
