import json
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


class TestStep13BetaReadiness(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        script_path = repo_root / "scripts" / "run_beta_readiness.py"
        module_spec = importlib.util.spec_from_file_location("run_beta_readiness", script_path)
        if module_spec is None or module_spec.loader is None:
            raise RuntimeError(f"Unable to load beta readiness module from {script_path}")
        run_beta_readiness = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(run_beta_readiness)

        cls.repo_root = repo_root
        cls.beta_readiness = run_beta_readiness

    def test_evaluate_beta_readiness_passes_when_inputs_meet_gates(self):
        benchmark_report = {
            "regression_gate_passed": True,
            "summary": {
                "field_precision": 0.9,
                "field_recall": 0.9,
                "numeric_exact_match": 0.9,
                "table_structure_correctness": 1.0,
            },
        }
        ops_snapshot = {
            "p95_latency_ms": 2000,
            "failure_rate": 0.01,
            "queue_depth": 50,
        }
        requirements = {
            "field_precision": 0.85,
            "field_recall": 0.85,
            "numeric_exact_match": 0.8,
            "table_structure_correctness": 1.0,
            "max_p95_latency_ms": 4000,
            "max_failure_rate": 0.05,
            "max_queue_depth": 250,
        }

        report = self.beta_readiness.evaluate_beta_readiness(benchmark_report, ops_snapshot, requirements)

        self.assertTrue(report["beta_ready"])
        self.assertEqual(report["blockers"], [])

    def test_evaluate_beta_readiness_collects_blockers(self):
        benchmark_report = {
            "regression_gate_passed": False,
            "summary": {
                "field_precision": 0.8,
                "field_recall": 0.8,
                "numeric_exact_match": 0.7,
                "table_structure_correctness": 0.9,
            },
        }
        ops_snapshot = {
            "p95_latency_ms": 5000,
            "failure_rate": 0.09,
            "queue_depth": 400,
        }
        requirements = {
            "field_precision": 0.85,
            "field_recall": 0.85,
            "numeric_exact_match": 0.8,
            "table_structure_correctness": 1.0,
            "max_p95_latency_ms": 4000,
            "max_failure_rate": 0.05,
            "max_queue_depth": 250,
        }

        report = self.beta_readiness.evaluate_beta_readiness(benchmark_report, ops_snapshot, requirements)

        self.assertFalse(report["beta_ready"])
        self.assertTrue(any("benchmark_regression_gate_failed" in value for value in report["blockers"]))
        self.assertTrue(any("latency_too_high" in value for value in report["blockers"]))

    def test_main_writes_beta_readiness_report(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            benchmark_path = tmp_root / "benchmark.json"
            ops_path = tmp_root / "ops.json"
            output_path = tmp_root / "beta_report.json"

            benchmark_report = {
                "regression_gate_passed": True,
                "summary": {
                    "field_precision": 0.9,
                    "field_recall": 0.9,
                    "numeric_exact_match": 0.9,
                    "table_structure_correctness": 1.0,
                },
            }
            ops_snapshot = {
                "p95_latency_ms": 2000,
                "failure_rate": 0.01,
                "queue_depth": 50,
            }

            benchmark_path.write_text(json.dumps(benchmark_report), encoding="utf-8")
            ops_path.write_text(json.dumps(ops_snapshot), encoding="utf-8")

            original_argv = sys.argv
            try:
                sys.argv = [
                    "run_beta_readiness.py",
                    "--benchmark-report",
                    str(benchmark_path),
                    "--ops-snapshot",
                    str(ops_path),
                    "--output",
                    str(output_path),
                ]
                self.beta_readiness.main()
            finally:
                sys.argv = original_argv

            self.assertTrue(output_path.exists())
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertIn("beta_ready", payload)


if __name__ == "__main__":
    unittest.main()
