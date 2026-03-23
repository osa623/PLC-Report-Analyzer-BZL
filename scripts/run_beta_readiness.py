from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

DEFAULT_BENCHMARK_REPORT = "data/eval/last_benchmark_report.json"
DEFAULT_OPS_SNAPSHOT = "data/eval/ops_snapshot.json"
DEFAULT_OUTPUT = "data/eval/last_beta_readiness_report.json"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def evaluate_beta_readiness(
    benchmark_report: dict[str, Any],
    ops_snapshot: dict[str, Any],
    requirements: dict[str, float],
) -> dict[str, Any]:
    blockers: list[str] = []

    if not benchmark_report.get("regression_gate_passed", False):
        blockers.append("benchmark_regression_gate_failed")

    summary = benchmark_report.get("summary", {})
    required_metrics = [
        "field_precision",
        "field_recall",
        "numeric_exact_match",
        "table_structure_correctness",
    ]
    for metric in required_metrics:
        min_value = float(requirements.get(metric, 0.0))
        score = float(summary.get(metric, 0.0))
        if score < min_value:
            blockers.append(f"metric_below_target:{metric}:{score}<{min_value}")

    max_p95_latency_ms = float(requirements.get("max_p95_latency_ms", 0.0))
    p95_latency_ms = float(ops_snapshot.get("p95_latency_ms", 0.0))
    if max_p95_latency_ms > 0 and p95_latency_ms > max_p95_latency_ms:
        blockers.append(f"latency_too_high:{p95_latency_ms}>{max_p95_latency_ms}")

    max_failure_rate = float(requirements.get("max_failure_rate", 0.0))
    failure_rate = float(ops_snapshot.get("failure_rate", 0.0))
    if max_failure_rate > 0 and failure_rate > max_failure_rate:
        blockers.append(f"failure_rate_too_high:{failure_rate}>{max_failure_rate}")

    max_queue_depth = float(requirements.get("max_queue_depth", 0.0))
    queue_depth = float(ops_snapshot.get("queue_depth", 0.0))
    if max_queue_depth > 0 and queue_depth > max_queue_depth:
        blockers.append(f"queue_depth_too_high:{queue_depth}>{max_queue_depth}")

    return {
        "beta_ready": len(blockers) == 0,
        "blockers": blockers,
        "requirements": requirements,
        "observed": {
            "p95_latency_ms": p95_latency_ms,
            "failure_rate": failure_rate,
            "queue_depth": queue_depth,
            "benchmark_summary": summary,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Step 13 beta readiness gate.")
    parser.add_argument("--benchmark-report", default=DEFAULT_BENCHMARK_REPORT)
    parser.add_argument("--ops-snapshot", default=DEFAULT_OPS_SNAPSHOT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--fail-on-blocker", action="store_true")
    args = parser.parse_args()

    benchmark_report = _load_json(Path(args.benchmark_report))
    ops_snapshot = _load_json(Path(args.ops_snapshot))

    requirements = {
        "field_precision": 0.85,
        "field_recall": 0.85,
        "numeric_exact_match": 0.8,
        "table_structure_correctness": 1.0,
        "max_p95_latency_ms": 4000,
        "max_failure_rate": 0.05,
        "max_queue_depth": 250,
    }

    report = evaluate_beta_readiness(benchmark_report, ops_snapshot, requirements)
    _write_json(Path(args.output), report)

    print(f"beta_ready={report['beta_ready']}")
    if report["blockers"]:
        print("blockers:")
        for blocker in report["blockers"]:
            print(f"- {blocker}")

    if args.fail_on_blocker and report["blockers"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
