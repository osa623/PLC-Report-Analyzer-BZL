#!/usr/bin/env python3
"""Tune confidence scoring weights against local golden summary artifacts.

This script calibrates the confidence-weight formula using available
`data/eval/real_pdf_batch_summary*.json` snapshots (plus allgate summary)
and writes a report with baseline vs tuned fit.
"""

from __future__ import annotations

import argparse
import glob
import json
import random
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FeatureRow:
    validation_pass_rate: float
    statement_completeness: float
    unit_consistency: float
    multi_year_continuity: float
    year_coverage: float
    re_extraction_success_rate: float
    ratio_coverage: float
    extraction_confidence: float
    extraction_agreement: float
    issue_count: float
    hard_fail_count: float
    target: float


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _load_json(path: Path) -> dict:
    # Files in this repo can include UTF-8 BOM.
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _extract_rows(eval_dir: Path) -> list[FeatureRow]:
    summary_paths = sorted(glob.glob(str(eval_dir / "real_pdf_batch_summary*.json")))
    summary_paths.append(str(eval_dir / "allgate_4pdf_latest.json"))

    rows: list[FeatureRow] = []
    for raw_path in summary_paths:
        path = Path(raw_path)
        if not path.exists():
            continue

        payload = _load_json(path)
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list):
            items = [payload]

        for item in items:
            gates = item.get("gates") if isinstance(item, dict) else None
            if not isinstance(gates, dict) or not gates:
                gates = {
                    key: item.get(key)
                    for key in (
                        "gate_1_balance_sheet_identity",
                        "gate_2_cash_reconciliation",
                        "gate_3_net_income_linkage",
                        "gate_4_multi_year_continuity",
                        "gate_5_unit_consistency",
                    )
                    if isinstance(item, dict) and key in item
                }
            if not gates:
                continue

            gate_values = [bool(v) for v in gates.values()]
            gate_count = max(len(gate_values), 1)
            validation_pass_rate = sum(1 for v in gate_values if v) / float(gate_count)
            hard_fail_count = float(sum(1 for v in gate_values if not v))

            gate_failures = item.get("gate_failures", []) if isinstance(item, dict) else []
            if isinstance(gate_failures, str):
                gate_failures = [x.strip() for x in gate_failures.split(";") if x.strip()]
            has_min_completeness_failure = any(
                isinstance(x, str) and "minimum_completeness" in x for x in gate_failures
            )

            gate_1 = float(bool(gates.get("gate_1_balance_sheet_identity", False)))
            gate_3 = float(bool(gates.get("gate_3_net_income_linkage", False)))
            gate_4 = float(bool(gates.get("gate_4_multi_year_continuity", False)))
            gate_5 = float(bool(gates.get("gate_5_unit_consistency", False)))

            # Completeness proxy inferred from hard-gate outcomes.
            statement_completeness = 0.45 + (0.35 * gate_3) + (0.10 * gate_1)
            if has_min_completeness_failure:
                statement_completeness -= 0.25
            statement_completeness = _clamp01(statement_completeness)

            confidence_score = item.get("confidence_score") if isinstance(item, dict) else None
            if confidence_score is None:
                reliability_score = item.get("reliability_score") if isinstance(item, dict) else None
                confidence_score = (
                    float(reliability_score) / 100.0 if reliability_score is not None else None
                )
            if confidence_score is None:
                continue

            rows.append(
                FeatureRow(
                    validation_pass_rate=validation_pass_rate,
                    statement_completeness=statement_completeness,
                    unit_consistency=gate_5,
                    multi_year_continuity=gate_4,
                    year_coverage=0.85 if gate_4 else 0.55,
                    re_extraction_success_rate=1.0,
                    ratio_coverage=1.0 if gate_1 else 0.7,
                    extraction_confidence=1.0,
                    extraction_agreement=0.0,
                    issue_count=float(item.get("validation_issues", 0) if isinstance(item, dict) else 0),
                    hard_fail_count=hard_fail_count,
                    target=_clamp01(float(confidence_score)),
                )
            )

    return rows


def _predict(row: FeatureRow, params: dict[str, float]) -> float:
    score = params["base"]
    score += params["w_comp"] * row.statement_completeness
    score += params["w_val"] * row.validation_pass_rate
    score += params["w_unit"] * row.unit_consistency
    score += params["w_cont"] * row.multi_year_continuity
    score += params["w_year"] * row.year_coverage
    score += params["w_rex"] * row.re_extraction_success_rate
    score += params["w_ratio"] * row.ratio_coverage
    score += params["w_ext_conf"] * row.extraction_confidence
    score += params["w_ext_ag"] * row.extraction_agreement

    score -= min(row.issue_count * params["issue_coef"], params["issue_cap"])
    score -= row.hard_fail_count * params["hard_fail_coef"]
    return _clamp01(score)


def _mae(rows: list[FeatureRow], params: dict[str, float]) -> float:
    return sum(abs(_predict(r, params) - r.target) for r in rows) / float(len(rows))


def tune(rows: list[FeatureRow], seed: int, samples: int) -> tuple[dict[str, float], dict[str, float], float, float]:
    baseline = {
        "base": 0.10,
        "w_comp": 0.18,
        "w_val": 0.17,
        "w_unit": 0.10,
        "w_cont": 0.10,
        "w_year": 0.10,
        "w_rex": 0.10,
        "w_ratio": 0.10,
        "w_ext_conf": 0.08,
        "w_ext_ag": 0.07,
        "issue_coef": 0.05,
        "issue_cap": 0.35,
        "hard_fail_coef": 0.0,
    }

    best = baseline
    best_mae = _mae(rows, baseline)

    random.seed(seed)
    for _ in range(samples):
        candidate = {
            "base": random.uniform(0.02, 0.20),
            "w_comp": random.uniform(0.12, 0.30),
            "w_val": random.uniform(0.25, 0.45),
            "w_unit": random.uniform(0.04, 0.14),
            "w_cont": random.uniform(0.03, 0.14),
            "w_year": random.uniform(0.03, 0.12),
            "w_rex": random.uniform(0.03, 0.12),
            "w_ratio": random.uniform(0.06, 0.18),
            "w_ext_conf": random.uniform(0.04, 0.12),
            "w_ext_ag": random.uniform(0.00, 0.06),
            "issue_coef": random.uniform(0.02, 0.08),
            "issue_cap": random.uniform(0.20, 0.45),
            "hard_fail_coef": random.uniform(0.02, 0.12),
        }
        cand_mae = _mae(rows, candidate)
        if cand_mae < best_mae:
            best = candidate
            best_mae = cand_mae

    return baseline, best, _mae(rows, baseline), best_mae


def main() -> int:
    parser = argparse.ArgumentParser(description="Tune confidence weights against eval summaries")
    parser.add_argument(
        "--eval-dir",
        default="data/eval",
        help="Directory containing real_pdf_batch_summary*.json",
    )
    parser.add_argument(
        "--output",
        default="data/eval/confidence_weight_tuning_report.json",
        help="Path to write tuning report JSON",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--samples", type=int, default=180000, help="Random samples")
    args = parser.parse_args()

    eval_dir = Path(args.eval_dir)
    rows = _extract_rows(eval_dir)
    if not rows:
        raise SystemExit("No evaluable rows found for tuning")

    baseline, tuned, baseline_mae, tuned_mae = tune(rows, seed=args.seed, samples=args.samples)

    report = {
        "rows": len(rows),
        "seed": args.seed,
        "samples": args.samples,
        "baseline_mae": baseline_mae,
        "tuned_mae": tuned_mae,
        "mae_improvement_pct": ((baseline_mae - tuned_mae) / max(baseline_mae, 1e-9)) * 100.0,
        "baseline": baseline,
        "tuned": tuned,
        "preview": [
            {
                "target": row.target,
                "baseline_prediction": _predict(row, baseline),
                "tuned_prediction": _predict(row, tuned),
                "validation_pass_rate": row.validation_pass_rate,
                "issue_count": row.issue_count,
                "hard_fail_count": row.hard_fail_count,
            }
            for row in rows[:10]
        ],
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Loaded {len(rows)} rows")
    print(f"Baseline MAE: {baseline_mae:.6f}")
    print(f"Tuned MAE:    {tuned_mae:.6f}")
    print(f"Improvement:  {report['mae_improvement_pct']:.2f}%")
    print(f"Wrote report to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
