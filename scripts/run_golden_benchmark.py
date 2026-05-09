#!/usr/bin/env python3
"""Golden benchmark for deterministic, reproducible dashboard outputs.

Compares expected and predicted pipeline outputs using strict numerical tolerance
(default 0.01% relative error), computes aggregate quality metrics, and applies
regression gates suitable for CI.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_METADATA_PATH = ROOT / "data" / "eval" / "golden_set_metadata.json"
DEFAULT_THRESHOLDS_PATH = ROOT / "data" / "eval" / "thresholds.json"
DEFAULT_OUTPUT_PATH = ROOT / "data" / "eval" / "golden_benchmark_report.json"
DEFAULT_TOLERANCE = 0.0001  # 0.01%


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _flatten_leaf_fields(payload: Any, prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    if isinstance(payload, dict):
        for key in sorted(payload.keys()):
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            out.update(_flatten_leaf_fields(payload[key], child_prefix))
        return out
    if isinstance(payload, list):
        for idx, item in enumerate(payload):
            child_prefix = f"{prefix}[{idx}]"
            out.update(_flatten_leaf_fields(item, child_prefix))
        return out
    out[prefix] = payload
    return out


def _extract_table_shapes(payload: Any, prefix: str = "") -> dict[str, int]:
    out: dict[str, int] = {}
    if isinstance(payload, dict):
        for key, value in payload.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            out.update(_extract_table_shapes(value, child_prefix))
        return out
    if isinstance(payload, list):
        out[prefix] = len(payload)
        for idx, item in enumerate(payload):
            child_prefix = f"{prefix}[{idx}]"
            out.update(_extract_table_shapes(item, child_prefix))
    return out


def _relative_error(expected: float, predicted: float) -> float:
    denom = max(abs(float(expected)), 1e-12)
    return abs(float(predicted) - float(expected)) / denom


def evaluate_case_payloads(
    expected_payload: dict[str, Any],
    predicted_payload: dict[str, Any],
    tolerance: float = DEFAULT_TOLERANCE,
) -> dict[str, Any]:
    expected_fields = _flatten_leaf_fields(expected_payload)
    predicted_fields = _flatten_leaf_fields(predicted_payload)

    expected_keys = set(expected_fields.keys())
    predicted_keys = set(predicted_fields.keys())
    common_keys = expected_keys.intersection(predicted_keys)

    value_matches = 0
    for key in common_keys:
        ev = expected_fields[key]
        pv = predicted_fields[key]
        if isinstance(ev, (int, float)) and isinstance(pv, (int, float)):
            if _relative_error(float(ev), float(pv)) <= tolerance:
                value_matches += 1
        elif ev == pv:
            value_matches += 1

    field_precision = value_matches / float(len(predicted_keys) or 1)
    field_recall = value_matches / float(len(expected_keys) or 1)

    numeric_common: list[tuple[str, float, float]] = []
    for key in sorted(common_keys):
        ev = expected_fields[key]
        pv = predicted_fields[key]
        if isinstance(ev, (int, float)) and isinstance(pv, (int, float)):
            numeric_common.append((key, float(ev), float(pv)))

    if numeric_common:
        rel_errors = [_relative_error(e, p) for _, e, p in numeric_common]
        exact_matches = len([err for err in rel_errors if err <= tolerance])
        numeric_exact_match = exact_matches / float(len(numeric_common))
        max_relative_error_pct = max(rel_errors) * 100.0
    else:
        numeric_exact_match = 1.0
        max_relative_error_pct = 0.0

    expected_shapes = _extract_table_shapes(expected_payload)
    predicted_shapes = _extract_table_shapes(predicted_payload)
    shape_keys = set(expected_shapes.keys()).intersection(set(predicted_shapes.keys()))
    if shape_keys:
        shape_matches = len([k for k in shape_keys if expected_shapes[k] == predicted_shapes[k]])
        table_structure_correctness = shape_matches / float(len(shape_keys))
    else:
        table_structure_correctness = 1.0

    deterministic_parity = 1.0 if numeric_exact_match == 1.0 and max_relative_error_pct <= (tolerance * 100.0) else 0.0

    return {
        "field_precision": round(field_precision, 6),
        "field_recall": round(field_recall, 6),
        "numeric_exact_match": round(numeric_exact_match, 6),
        "table_structure_correctness": round(table_structure_correctness, 6),
        "deterministic_parity": round(deterministic_parity, 6),
        "max_relative_error_pct": round(max_relative_error_pct, 8),
        "numeric_points": len(numeric_common),
        "tolerance_pct": round(tolerance * 100.0, 8),
    }


def _resolve_case_path(path_value: str, repo_root: Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return repo_root / path


def evaluate_dataset(metadata_path: str | Path, repo_root: str | Path | None = None) -> dict[str, Any]:
    metadata_file = Path(metadata_path)
    root = Path(repo_root) if repo_root is not None else ROOT
    metadata = _load_json(metadata_file)

    dataset_name = str(metadata.get("dataset_name") or metadata.get("name") or "unknown-dataset")
    dataset_version = str(metadata.get("dataset_version") or "1.0.0")
    tolerance_pct = float(metadata.get("tolerance_pct", 0.01))
    tolerance = tolerance_pct / 100.0

    cases = metadata.get("cases") if isinstance(metadata.get("cases"), list) else []
    case_reports: list[dict[str, Any]] = []

    for idx, case in enumerate(cases):
        if not isinstance(case, dict):
            continue
        case_id = str(case.get("case_id") or f"case_{idx + 1}")
        expected_path = _resolve_case_path(str(case.get("expected_path")), root)
        predicted_path = _resolve_case_path(str(case.get("predicted_path")), root)

        expected_payload = _load_json(expected_path)
        predicted_payload = _load_json(predicted_path)
        metrics = evaluate_case_payloads(expected_payload, predicted_payload, tolerance=tolerance)

        case_reports.append(
            {
                "case_id": case_id,
                "expected_path": str(expected_path),
                "predicted_path": str(predicted_path),
                "metrics": metrics,
            }
        )

    metric_names = [
        "field_precision",
        "field_recall",
        "numeric_exact_match",
        "table_structure_correctness",
        "deterministic_parity",
    ]
    aggregate_scores = {
        name: round(
            sum(float(case["metrics"].get(name, 0.0)) for case in case_reports) / float(len(case_reports) or 1),
            6,
        )
        for name in metric_names
    }
    max_relative_error_pct = round(
        max([float(case["metrics"].get("max_relative_error_pct", 0.0)) for case in case_reports], default=0.0),
        8,
    )

    return {
        "dataset_name": dataset_name,
        "dataset_version": dataset_version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "case_count": len(case_reports),
            "aggregate_scores": aggregate_scores,
            "max_relative_error_pct": max_relative_error_pct,
            "tolerance_pct": tolerance_pct,
        },
        "cases": case_reports,
    }


def check_regression_gate(thresholds: dict[str, Any], scores: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    for metric, threshold in thresholds.items():
        if not isinstance(threshold, (int, float)):
            continue
        value = scores.get(metric)
        if not isinstance(value, (int, float)):
            failures.append(f"{metric}:missing")
            continue

        if metric in {"max_relative_error_pct", "tolerance_pct"}:
            if float(value) > float(threshold):
                failures.append(f"{metric}:{value:.8f}>{threshold:.8f}")
        else:
            if float(value) < float(threshold):
                failures.append(f"{metric}:{value:.6f}<{threshold:.6f}")
    return failures


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run golden benchmark against expected dashboard outputs")
    parser.add_argument("--metadata", default=str(DEFAULT_METADATA_PATH), help="Golden dataset metadata JSON path")
    parser.add_argument("--thresholds", default=str(DEFAULT_THRESHOLDS_PATH), help="Regression threshold JSON path")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH), help="Output report path")
    parser.add_argument("--fail-on-regression", action="store_true", help="Exit 1 when regression gate fails")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata_path = Path(args.metadata)
    thresholds_path = Path(args.thresholds)
    output_path = Path(args.output)

    dataset_report = evaluate_dataset(metadata_path=metadata_path, repo_root=ROOT)
    thresholds = _load_json(thresholds_path)
    aggregate_scores = dataset_report.get("summary", {}).get("aggregate_scores", {})
    scores_for_gate = dict(aggregate_scores)
    scores_for_gate["max_relative_error_pct"] = dataset_report.get("summary", {}).get("max_relative_error_pct", 0.0)
    scores_for_gate["tolerance_pct"] = dataset_report.get("summary", {}).get("tolerance_pct", 0.01)

    failures = check_regression_gate(thresholds, scores_for_gate)

    report = {
        **dataset_report,
        "thresholds": thresholds,
        "gate_scores": scores_for_gate,
        "regression_gate_failures": failures,
        "regression_gate_passed": len(failures) == 0,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.fail_on_regression and failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
