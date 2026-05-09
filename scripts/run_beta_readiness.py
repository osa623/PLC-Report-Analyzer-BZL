import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _read_summary_metrics(benchmark_report: dict[str, Any]) -> dict[str, float]:
    summary = benchmark_report.get("summary")
    if not isinstance(summary, dict):
        return {}

    aggregate_scores = summary.get("aggregate_scores")
    if isinstance(aggregate_scores, dict):
        return {k: float(v) for k, v in aggregate_scores.items() if isinstance(v, (int, float))}

    return {k: float(v) for k, v in summary.items() if isinstance(v, (int, float))}


def evaluate_beta_readiness(
    benchmark_report: dict[str, Any],
    ops_snapshot: dict[str, Any],
    requirements: dict[str, float],
) -> dict[str, Any]:
    blockers: list[str] = []
    metrics = _read_summary_metrics(benchmark_report)

    if not benchmark_report.get("regression_gate_passed", False):
        blockers.append("benchmark_regression_gate_failed")

    for metric in [
        "field_precision",
        "field_recall",
        "numeric_exact_match",
        "table_structure_correctness",
    ]:
        required = requirements.get(metric)
        actual = metrics.get(metric)
        if isinstance(required, (int, float)):
            if not isinstance(actual, (int, float)):
                blockers.append(f"metric_missing:{metric}")
            elif float(actual) < float(required):
                blockers.append(f"metric_below_threshold:{metric}:{actual:.6f}<{required:.6f}")

    p95_latency_ms = ops_snapshot.get("p95_latency_ms")
    max_p95_latency_ms = requirements.get("max_p95_latency_ms")
    if isinstance(max_p95_latency_ms, (int, float)):
        if not isinstance(p95_latency_ms, (int, float)):
            blockers.append("latency_missing")
        elif float(p95_latency_ms) > float(max_p95_latency_ms):
            blockers.append(f"latency_too_high:{p95_latency_ms}>{max_p95_latency_ms}")

    failure_rate = ops_snapshot.get("failure_rate")
    max_failure_rate = requirements.get("max_failure_rate")
    if isinstance(max_failure_rate, (int, float)):
        if not isinstance(failure_rate, (int, float)):
            blockers.append("failure_rate_missing")
        elif float(failure_rate) > float(max_failure_rate):
            blockers.append(f"failure_rate_too_high:{failure_rate:.6f}>{max_failure_rate:.6f}")

    queue_depth = ops_snapshot.get("queue_depth")
    max_queue_depth = requirements.get("max_queue_depth")
    if isinstance(max_queue_depth, (int, float)):
        if not isinstance(queue_depth, (int, float)):
            blockers.append("queue_depth_missing")
        elif float(queue_depth) > float(max_queue_depth):
            blockers.append(f"queue_depth_too_high:{queue_depth}>{max_queue_depth}")

    return {
        "beta_ready": len(blockers) == 0,
        "blockers": blockers,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "benchmark_report": benchmark_report,
            "ops_snapshot": ops_snapshot,
            "requirements": requirements,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate beta readiness gates")
    parser.add_argument("--benchmark-report", required=True, help="Path to benchmark report JSON")
    parser.add_argument("--ops-snapshot", required=True, help="Path to ops snapshot JSON")
    parser.add_argument("--output", required=True, help="Path to write beta readiness report JSON")
    parser.add_argument(
        "--fail-on-blocker",
        action="store_true",
        help="Exit with code 1 when blockers are present",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    benchmark_path = Path(args.benchmark_report)
    ops_snapshot_path = Path(args.ops_snapshot)
    output_path = Path(args.output)

    benchmark_report = _load_json(benchmark_path)
    ops_snapshot = _load_json(ops_snapshot_path)

    requirements: dict[str, float] = {
        "field_precision": 0.85,
        "field_recall": 0.85,
        "numeric_exact_match": 0.80,
        "table_structure_correctness": 1.0,
        "max_p95_latency_ms": 4000,
        "max_failure_rate": 0.05,
        "max_queue_depth": 250,
    }

    report = evaluate_beta_readiness(
        benchmark_report=benchmark_report,
        ops_snapshot=ops_snapshot,
        requirements=requirements,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.fail_on_blocker and not report["beta_ready"]:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as exc:
        print(f"Missing input file: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc