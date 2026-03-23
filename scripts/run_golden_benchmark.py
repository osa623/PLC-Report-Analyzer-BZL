from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_METADATA = "data/eval/golden_set_metadata.json"
DEFAULT_THRESHOLDS = "data/eval/thresholds.json"
DEFAULT_REPORT_OUTPUT = "data/eval/last_benchmark_report.json"


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _normalize_scalar(value: Any) -> str:
    if isinstance(value, float):
        return format(value, ".10g")
    return str(value)


def _as_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace(",", "").strip()
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _flatten_fields(payload: Any, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}

    if isinstance(payload, dict):
        for key, value in payload.items():
            nested_key = f"{prefix}.{key}" if prefix else key
            flat.update(_flatten_fields(value, nested_key))
        return flat

    if isinstance(payload, list):
        for index, item in enumerate(payload):
            nested_key = f"{prefix}[{index}]" if prefix else f"[{index}]"
            flat.update(_flatten_fields(item, nested_key))
        return flat

    if prefix:
        flat[prefix] = _normalize_scalar(payload)
    return flat


def _extract_table_shapes(payload: Any, root: str = "") -> dict[str, dict[str, int]]:
    tables: dict[str, dict[str, int]] = {}

    if isinstance(payload, dict):
        if payload and all(isinstance(k, str) for k in payload):
            if isinstance(payload.get("rows"), list) and isinstance(payload.get("cols"), list):
                tables[root] = {
                    "rows": len(payload.get("rows", [])),
                    "cols": len(payload.get("cols", [])),
                }

        for key, value in payload.items():
            nested_key = f"{root}.{key}" if root else key
            tables.update(_extract_table_shapes(value, nested_key))

    elif isinstance(payload, list):
        for index, item in enumerate(payload):
            nested_key = f"{root}[{index}]" if root else f"[{index}]"
            tables.update(_extract_table_shapes(item, nested_key))

    return tables


def _safe_divide(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator > 0 else 1.0


def _compute_field_precision_recall(expected: dict[str, str], predicted: dict[str, str]) -> tuple[float, float]:
    expected_pairs = {(k, v) for k, v in expected.items()}
    predicted_pairs = {(k, v) for k, v in predicted.items()}
    true_positives = len(expected_pairs & predicted_pairs)

    precision = _safe_divide(true_positives, len(predicted_pairs))
    recall = _safe_divide(true_positives, len(expected_pairs))
    return precision, recall


def _compute_numeric_exact_match(expected: dict[str, str], predicted: dict[str, str]) -> float:
    expected_numeric: dict[str, float] = {}
    predicted_numeric: dict[str, float] = {}

    for key, value in expected.items():
        converted = _as_float(value)
        if converted is not None:
            expected_numeric[key] = converted

    for key, value in predicted.items():
        converted = _as_float(value)
        if converted is not None:
            predicted_numeric[key] = converted

    if not expected_numeric:
        return 1.0

    total = len(expected_numeric)
    matches = 0
    for key, expected_value in expected_numeric.items():
        predicted_value = predicted_numeric.get(key)
        if predicted_value is not None and abs(predicted_value - expected_value) <= 1e-9:
            matches += 1

    return _safe_divide(matches, total)


def _compute_table_structure_correctness(expected_tables: dict[str, dict[str, int]], predicted_tables: dict[str, dict[str, int]]) -> float:
    if not expected_tables:
        return 1.0

    total = len(expected_tables)
    matches = 0

    for table_path, expected_shape in expected_tables.items():
        predicted_shape = predicted_tables.get(table_path)
        if not predicted_shape:
            continue
        if predicted_shape.get("rows") == expected_shape.get("rows") and predicted_shape.get("cols") == expected_shape.get("cols"):
            matches += 1

    return _safe_divide(matches, total)


def evaluate_case_payloads(expected_payload: dict[str, Any], predicted_payload: dict[str, Any]) -> dict[str, float]:
    expected_fields = _flatten_fields(expected_payload)
    predicted_fields = _flatten_fields(predicted_payload)

    field_precision, field_recall = _compute_field_precision_recall(expected_fields, predicted_fields)
    numeric_exact_match = _compute_numeric_exact_match(expected_fields, predicted_fields)

    expected_tables = _extract_table_shapes(expected_payload)
    predicted_tables = _extract_table_shapes(predicted_payload)
    table_structure_correctness = _compute_table_structure_correctness(expected_tables, predicted_tables)

    return {
        "field_precision": round(field_precision, 6),
        "field_recall": round(field_recall, 6),
        "numeric_exact_match": round(numeric_exact_match, 6),
        "table_structure_correctness": round(table_structure_correctness, 6),
    }


def _resolve_path(base_dir: Path, candidate: str) -> Path:
    candidate_path = Path(candidate)
    if candidate_path.is_absolute():
        return candidate_path
    return (base_dir / candidate_path).resolve()


def evaluate_dataset(metadata_path: str, base_dir: Path) -> dict[str, Any]:
    metadata = _load_json(Path(metadata_path))
    case_reports: list[dict[str, Any]] = []

    for case in metadata.get("cases", []):
        expected_path = _resolve_path(base_dir, case["expected_path"])
        predicted_path = _resolve_path(base_dir, case["predicted_path"])

        expected_payload = _load_json(expected_path)
        predicted_payload = _load_json(predicted_path)
        scores = evaluate_case_payloads(expected_payload, predicted_payload)

        case_reports.append(
            {
                "case_id": case["case_id"],
                "domain": case.get("domain", "unknown"),
                "metrics": scores,
            }
        )

    def _average(metric: str) -> float:
        if not case_reports:
            return 1.0
        return round(sum(case_report["metrics"][metric] for case_report in case_reports) / len(case_reports), 6)

    summary = {
        "case_count": len(case_reports),
        "field_precision": _average("field_precision"),
        "field_recall": _average("field_recall"),
        "numeric_exact_match": _average("numeric_exact_match"),
        "table_structure_correctness": _average("table_structure_correctness"),
    }

    return {
        "dataset_name": metadata.get("dataset_name", "golden-eval"),
        "dataset_version": metadata.get("dataset_version", "0.1"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "cases": case_reports,
    }


def check_regression_gate(thresholds: dict[str, float], scores: dict[str, float]) -> list[str]:
    failures: list[str] = []
    tracked_metrics = [
        "field_precision",
        "field_recall",
        "numeric_exact_match",
        "table_structure_correctness",
    ]

    for metric in tracked_metrics:
        threshold = float(thresholds.get(metric, 0.0))
        score = float(scores.get(metric, 0.0))
        if score < threshold:
            failures.append(f"{metric}: score={score} threshold={threshold}")

    return failures


def _write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run golden dataset extraction benchmark.")
    parser.add_argument("--metadata", default=DEFAULT_METADATA, help="Path to golden metadata JSON file.")
    parser.add_argument("--thresholds", default=DEFAULT_THRESHOLDS, help="Path to score threshold JSON file.")
    parser.add_argument("--output", default=DEFAULT_REPORT_OUTPUT, help="Where to write benchmark report JSON.")
    parser.add_argument("--base-dir", default=None, help="Base directory for resolving relative case paths.")
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit with status code 1 when thresholds are not met.",
    )

    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    base_dir = Path(args.base_dir).resolve() if args.base_dir else repo_root

    metadata_path = _resolve_path(base_dir, args.metadata)
    threshold_path = _resolve_path(base_dir, args.thresholds)
    output_path = _resolve_path(base_dir, args.output)

    report = evaluate_dataset(str(metadata_path), base_dir)
    thresholds = _load_json(threshold_path)
    failures = check_regression_gate(thresholds, report["summary"])

    report["thresholds"] = thresholds
    report["regression_gate_passed"] = len(failures) == 0
    report["regression_gate_failures"] = failures

    _write_report(output_path, report)

    print("Golden benchmark completed")
    print(f"Cases: {report['summary']['case_count']}")
    print(f"Field precision: {report['summary']['field_precision']}")
    print(f"Field recall: {report['summary']['field_recall']}")
    print(f"Numeric exact match: {report['summary']['numeric_exact_match']}")
    print(f"Table structure correctness: {report['summary']['table_structure_correctness']}")
    print(f"Regression gate passed: {report['regression_gate_passed']}")

    if failures:
        print("Regression gate failures:")
        for failure in failures:
            print(f"- {failure}")

    if args.fail_on_regression and failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
