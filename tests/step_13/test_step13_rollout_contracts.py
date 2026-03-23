import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class TestStep13RolloutContracts(unittest.TestCase):
    def test_phase7_docs_deliverables_exist(self):
        launch_checklist = REPO_ROOT / "docs" / "LAUNCH_CHECKLIST.md"
        release_notes_template = REPO_ROOT / "docs" / "RELEASE_NOTES_TEMPLATE.md"
        beta_tuning_plan = REPO_ROOT / "docs" / "BETA_TUNING_PLAN.md"

        self.assertTrue(launch_checklist.exists(), f"Missing launch checklist: {launch_checklist}")
        self.assertTrue(release_notes_template.exists(), f"Missing release notes template: {release_notes_template}")
        self.assertTrue(beta_tuning_plan.exists(), f"Missing beta tuning plan: {beta_tuning_plan}")

        beta_text = beta_tuning_plan.read_text(encoding="utf-8-sig")
        self.assertIn("Internal rollout", beta_text)
        self.assertIn("Limited beta", beta_text)
        self.assertIn("public", beta_text.lower())

    def test_ci_workflow_includes_regression_and_beta_gates(self):
        workflow = REPO_ROOT / ".github" / "workflows" / "quality-gates.yml"
        self.assertTrue(workflow.exists(), f"Missing CI workflow: {workflow}")

        content = workflow.read_text(encoding="utf-8-sig")
        self.assertIn("run_golden_benchmark.py", content)
        self.assertIn("--fail-on-regression", content)
        self.assertIn("run_beta_readiness.py", content)
        self.assertIn("--fail-on-blocker", content)

    def test_eval_ops_snapshot_exists(self):
        ops_snapshot = REPO_ROOT / "data" / "eval" / "ops_snapshot.json"
        self.assertTrue(ops_snapshot.exists(), f"Missing ops snapshot: {ops_snapshot}")
        snapshot_text = ops_snapshot.read_text(encoding="utf-8-sig")
        self.assertIn("p95_latency_ms", snapshot_text)
        self.assertIn("failure_rate", snapshot_text)
        self.assertIn("queue_depth", snapshot_text)


if __name__ == "__main__":
    unittest.main()
