from __future__ import annotations


def compare_sector(ratios: dict[str, float]) -> dict:
    benchmarks = {"current_ratio": 1.5, "debt_to_assets": 0.55, "return_on_assets": 0.08}
    deltas = {k: ratios.get(k, 0.0) - benchmarks[k] for k in benchmarks}
    return {"benchmarks": benchmarks, "delta": deltas}
