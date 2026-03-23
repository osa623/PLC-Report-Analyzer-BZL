from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

DEFAULT_BENCHMARK_REPORT = "data/eval/last_benchmark_report.json"
DEFAULT_BETA_REPORT = "data/eval/last_beta_readiness_report.json"
DEFAULT_READINESS_SNAPSHOT = "data/eval/release_readiness_snapshot.json"
DEFAULT_OUTPUT = "data/eval/last_release_readiness_report.json"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def evaluate_public_launch_readiness(
    benchmark_report: dict[str, Any],
    beta_report: dict[str, Any],
    readiness_snapshot: dict[str, Any],
) -> dict[str, Any]:
    blockers: list[str] = []

    if not benchmark_report.get("regression_gate_passed", False):
        blockers.append("benchmark_gate_failed")

    if not beta_report.get("beta_ready", False):
        blockers.append("beta_gate_failed")

    checks = {
        "async_processing_stable": "async_multi_file_not_stable",
        "cost_abuse_controls_active": "cost_abuse_controls_not_active",
        "monitoring_runbooks_live": "monitoring_or_runbooks_not_live",
        "data_retention_privacy_implemented": "retention_privacy_not_implemented",
        "rollback_strategy_tested": "rollback_strategy_not_tested",
    }

    for field, blocker in checks.items():
        if not bool(readiness_snapshot.get(field, False)):
            blockers.append(blocker)

    return {
        "launch_ready": len(blockers) == 0,
        "blockers": blockers,
        "criteria": {
            "benchmark_gate_passed": bool(benchmark_report.get("regression_gate_passed", False)),
            "beta_gate_passed": bool(beta_report.get("beta_ready", False)),
            "async_processing_stable": bool(readiness_snapshot.get("async_processing_stable", False)),
            "cost_abuse_controls_active": bool(readiness_snapshot.get("cost_abuse_controls_active", False)),
            "monitoring_runbooks_live": bool(readiness_snapshot.get("monitoring_runbooks_live", False)),
            "data_retention_privacy_implemented": bool(
                readiness_snapshot.get("data_retention_privacy_implemented", False)
            ),
            "rollback_strategy_tested": bool(readiness_snapshot.get("rollback_strategy_tested", False)),
        },
        "stage": readiness_snapshot.get("stage", "unknown"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Step 14 public launch readiness gate.")
    parser.add_argument("--benchmark-report", default=DEFAULT_BENCHMARK_REPORT)
    parser.add_argument("--beta-report", default=DEFAULT_BETA_REPORT)
    parser.add_argument("--readiness-snapshot", default=DEFAULT_READINESS_SNAPSHOT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--fail-on-blocker", action="store_true")
    args = parser.parse_args()

    benchmark_report = _load_json(Path(args.benchmark_report))
    beta_report = _load_json(Path(args.beta_report))
    readiness_snapshot = _load_json(Path(args.readiness_snapshot))

    report = evaluate_public_launch_readiness(benchmark_report, beta_report, readiness_snapshot)
    _write_json(Path(args.output), report)

    print(f"launch_ready={report['launch_ready']}")
    if report["blockers"]:
        print("blockers:")
        for blocker in report["blockers"]:
            print(f"- {blocker}")

    if args.fail_on_blocker and report["blockers"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
