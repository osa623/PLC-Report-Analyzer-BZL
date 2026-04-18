import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def _load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def evaluate_public_launch_readiness(
    benchmark_report: Dict[str, Any],
    beta_report: Dict[str, Any],
    readiness_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    blockers: List[str] = []

    if not benchmark_report.get("regression_gate_passed", False):
        blockers.append("benchmark_gate_failed")

    if not beta_report.get("beta_ready", False):
        blockers.append("beta_readiness_gate_failed")

    if readiness_snapshot.get("stage") != "limited_beta":
        blockers.append("rollout_stage_not_limited_beta")

    if not readiness_snapshot.get("async_processing_stable", False):
        blockers.append("async_processing_not_stable")

    if not readiness_snapshot.get("cost_abuse_controls_active", False):
        blockers.append("cost_abuse_controls_not_active")

    if not readiness_snapshot.get("monitoring_runbooks_live", False):
        blockers.append("monitoring_or_runbooks_not_live")

    if not readiness_snapshot.get("data_retention_privacy_implemented", False):
        blockers.append("data_retention_or_privacy_not_implemented")

    if not readiness_snapshot.get("rollback_strategy_tested", False):
        blockers.append("rollback_strategy_not_tested")

    return {
        "launch_ready": len(blockers) == 0,
        "blockers": blockers,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "benchmark_report": benchmark_report,
            "beta_report": beta_report,
            "readiness_snapshot": readiness_snapshot,
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate public launch readiness gates")
    parser.add_argument("--benchmark-report", required=True, help="Path to benchmark report JSON")
    parser.add_argument("--beta-report", required=True, help="Path to beta readiness report JSON")
    parser.add_argument("--readiness-snapshot", required=True, help="Path to release readiness snapshot JSON")
    parser.add_argument("--output", required=True, help="Path to write release readiness report JSON")
    parser.add_argument(
        "--fail-on-blocker",
        action="store_true",
        help="Exit with code 1 when any blockers are found",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    benchmark_path = Path(args.benchmark_report)
    beta_path = Path(args.beta_report)
    readiness_path = Path(args.readiness_snapshot)
    output_path = Path(args.output)

    benchmark_report = _load_json(benchmark_path)
    beta_report = _load_json(beta_path)
    readiness_snapshot = _load_json(readiness_path)

    report = evaluate_public_launch_readiness(
        benchmark_report=benchmark_report,
        beta_report=beta_report,
        readiness_snapshot=readiness_snapshot,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.fail_on_blocker and not report["launch_ready"]:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as exc:
        print(f"Missing input file: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
