import json
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


class TestStep14ReleaseReadiness(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        script_path = repo_root / "scripts" / "run_release_readiness.py"
        module_spec = importlib.util.spec_from_file_location("run_release_readiness", script_path)
        if module_spec is None or module_spec.loader is None:
            raise RuntimeError(f"Unable to load release readiness module from {script_path}")
        run_release_readiness = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(run_release_readiness)

        cls.repo_root = repo_root
        cls.release_readiness = run_release_readiness

    def test_evaluate_public_launch_readiness_passes_when_all_criteria_true(self):
        benchmark_report = {"regression_gate_passed": True}
        beta_report = {"beta_ready": True}
        readiness_snapshot = {
            "stage": "limited_beta",
            "async_processing_stable": True,
            "cost_abuse_controls_active": True,
            "monitoring_runbooks_live": True,
            "data_retention_privacy_implemented": True,
            "rollback_strategy_tested": True,
        }

        report = self.release_readiness.evaluate_public_launch_readiness(
            benchmark_report,
            beta_report,
            readiness_snapshot,
        )

        self.assertTrue(report["launch_ready"])
        self.assertEqual(report["blockers"], [])

    def test_evaluate_public_launch_readiness_returns_blockers(self):
        benchmark_report = {"regression_gate_passed": False}
        beta_report = {"beta_ready": False}
        readiness_snapshot = {
            "stage": "limited_beta",
            "async_processing_stable": False,
            "cost_abuse_controls_active": False,
            "monitoring_runbooks_live": False,
            "data_retention_privacy_implemented": False,
            "rollback_strategy_tested": False,
        }

        report = self.release_readiness.evaluate_public_launch_readiness(
            benchmark_report,
            beta_report,
            readiness_snapshot,
        )

        self.assertFalse(report["launch_ready"])
        self.assertTrue(any("benchmark_gate_failed" in value for value in report["blockers"]))
        self.assertTrue(any("rollback_strategy_not_tested" in value for value in report["blockers"]))

    def test_main_writes_release_readiness_report(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_root = Path(tmp_dir)
            benchmark_path = tmp_root / "benchmark.json"
            beta_path = tmp_root / "beta.json"
            snapshot_path = tmp_root / "snapshot.json"
            output_path = tmp_root / "release.json"

            benchmark_report = {"regression_gate_passed": True}
            beta_report = {"beta_ready": True}
            snapshot = {
                "stage": "limited_beta",
                "async_processing_stable": True,
                "cost_abuse_controls_active": True,
                "monitoring_runbooks_live": True,
                "data_retention_privacy_implemented": True,
                "rollback_strategy_tested": True,
            }

            benchmark_path.write_text(json.dumps(benchmark_report), encoding="utf-8")
            beta_path.write_text(json.dumps(beta_report), encoding="utf-8")
            snapshot_path.write_text(json.dumps(snapshot), encoding="utf-8")

            original_argv = sys.argv
            try:
                sys.argv = [
                    "run_release_readiness.py",
                    "--benchmark-report",
                    str(benchmark_path),
                    "--beta-report",
                    str(beta_path),
                    "--readiness-snapshot",
                    str(snapshot_path),
                    "--output",
                    str(output_path),
                ]
                self.release_readiness.main()
            finally:
                sys.argv = original_argv

            self.assertTrue(output_path.exists())
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertIn("launch_ready", payload)


if __name__ == "__main__":
    unittest.main()
