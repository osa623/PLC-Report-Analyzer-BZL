import unittest

from scripts.run_beta_readiness import evaluate_beta_readiness
from scripts.run_golden_benchmark import check_regression_gate, evaluate_case_payloads
from scripts.run_release_readiness import evaluate_public_launch_readiness


class QualityGateTests(unittest.TestCase):
    def test_golden_benchmark_accepts_matching_payloads(self):
        expected = {
            "company": "Sample PLC",
            "years": [
                {"year": 2024, "revenue": 1000.0, "profit": 120.0},
                {"year": 2023, "revenue": 900.0, "profit": 100.0},
            ],
        }

        metrics = evaluate_case_payloads(expected, expected)
        failures = check_regression_gate(
            {
                "field_precision": 1.0,
                "field_recall": 1.0,
                "numeric_exact_match": 1.0,
                "table_structure_correctness": 1.0,
                "deterministic_parity": 1.0,
                "max_relative_error_pct": 0.01,
            },
            metrics,
        )

        self.assertEqual([], failures)

    def test_beta_and_release_readiness_accept_passing_inputs(self):
        benchmark_report = {
            "regression_gate_passed": True,
            "summary": {
                "aggregate_scores": {
                    "field_precision": 1.0,
                    "field_recall": 1.0,
                    "numeric_exact_match": 1.0,
                    "table_structure_correctness": 1.0,
                }
            },
        }
        ops_snapshot = {
            "p95_latency_ms": 1200,
            "failure_rate": 0.01,
            "queue_depth": 10,
        }
        beta_report = evaluate_beta_readiness(
            benchmark_report,
            ops_snapshot,
            {
                "field_precision": 0.85,
                "field_recall": 0.85,
                "numeric_exact_match": 0.80,
                "table_structure_correctness": 1.0,
                "max_p95_latency_ms": 4000,
                "max_failure_rate": 0.05,
                "max_queue_depth": 250,
            },
        )

        release_report = evaluate_public_launch_readiness(
            benchmark_report,
            beta_report,
            {
                "stage": "limited_beta",
                "async_processing_stable": True,
                "cost_abuse_controls_active": True,
                "monitoring_runbooks_live": True,
                "data_retention_privacy_implemented": True,
                "rollback_strategy_tested": True,
            },
        )

        self.assertTrue(beta_report["beta_ready"])
        self.assertTrue(release_report["launch_ready"])


if __name__ == "__main__":
    unittest.main()
