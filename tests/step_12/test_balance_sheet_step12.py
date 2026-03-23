import json
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


class TestStep12GoldenBenchmark(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        script_path = repo_root / "scripts" / "run_golden_benchmark.py"
        module_spec = importlib.util.spec_from_file_location("run_golden_benchmark", script_path)
        if module_spec is None or module_spec.loader is None:
            raise RuntimeError(f"Unable to load benchmark module from {script_path}")
        run_golden_benchmark = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(run_golden_benchmark)

        cls.repo_root = repo_root
        cls.benchmark = run_golden_benchmark

    def test_evaluate_case_payloads_computes_expected_metrics(self):
        expected_payload = {
            "field_a": "ok",
            "field_b": "x",
            "rows": [{"name": "cash", "value": 10}],
        }
        predicted_payload = {
            "field_a": "ok",
            "field_b": "mismatch",
            "rows": [{"name": "cash", "value": 10}],
        }

        metrics = self.benchmark.evaluate_case_payloads(expected_payload, predicted_payload)

        self.assertIn("field_precision", metrics)
        self.assertIn("field_recall", metrics)
        self.assertIn("numeric_exact_match", metrics)
        self.assertIn("table_structure_correctness", metrics)
        self.assertGreaterEqual(metrics["table_structure_correctness"], 0.0)
        self.assertLess(metrics["field_precision"], 1.0)

    def test_evaluate_dataset_reads_repo_golden_set(self):
        metadata_path = self.repo_root / "data" / "eval" / "golden_set_metadata.json"
        reports = self.benchmark.evaluate_dataset(str(metadata_path), self.repo_root)

        self.assertEqual(reports["dataset_name"], "plc-report-golden-set")
        self.assertEqual(reports["summary"]["case_count"], 1)
        self.assertIn("cases", reports)
        self.assertEqual(len(reports["cases"]), 1)

    def test_regression_gate_detects_threshold_failures(self):
        scores = {
            "field_precision": 0.5,
            "field_recall": 0.5,
            "numeric_exact_match": 0.6,
            "table_structure_correctness": 1.0,
        }
        thresholds = {
            "field_precision": 0.75,
            "field_recall": 0.75,
            "numeric_exact_match": 0.75,
            "table_structure_correctness": 1.0,
        }

        failures = self.benchmark.check_regression_gate(thresholds, scores)

        self.assertGreaterEqual(len(failures), 3)
        self.assertTrue(any("field_precision" in item for item in failures))
        self.assertTrue(any("field_recall" in item for item in failures))

    def test_main_writes_report_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            metadata_path = tmp_root / "metadata.json"
            thresholds_path = tmp_root / "thresholds.json"
            expected_path = tmp_root / "expected.json"
            predicted_path = tmp_root / "predicted.json"
            output_path = tmp_root / "report.json"

            expected_payload = {"field": "cash", "value": 100}
            predicted_payload = {"field": "cash", "value": 100}
            metadata = {
                "dataset_name": "tmp-dataset",
                "dataset_version": "0.0.1",
                "cases": [
                    {
                        "case_id": "tmp-case",
                        "expected_path": str(expected_path),
                        "predicted_path": str(predicted_path),
                    }
                ],
            }
            thresholds = {
                "field_precision": 0.5,
                "field_recall": 0.5,
                "numeric_exact_match": 0.5,
                "table_structure_correctness": 1.0,
            }

            expected_path.write_text(json.dumps(expected_payload), encoding="utf-8")
            predicted_path.write_text(json.dumps(predicted_payload), encoding="utf-8")
            metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
            thresholds_path.write_text(json.dumps(thresholds), encoding="utf-8")

            original_argv = sys.argv
            try:
                sys.argv = [
                    "run_golden_benchmark.py",
                    "--metadata",
                    str(metadata_path),
                    "--thresholds",
                    str(thresholds_path),
                    "--output",
                    str(output_path),
                ]
                self.benchmark.main()
            finally:
                sys.argv = original_argv

            self.assertTrue(output_path.exists())
            written = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertIn("regression_gate_passed", written)


if __name__ == "__main__":
    unittest.main()
