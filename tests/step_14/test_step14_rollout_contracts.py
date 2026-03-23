import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


class TestStep14RolloutContracts(unittest.TestCase):
    def test_step14_docs_exist(self):
        rollback_playbook = REPO_ROOT / "docs" / "ROLLBACK_PLAYBOOK.md"
        retention_privacy = REPO_ROOT / "docs" / "DATA_RETENTION_PRIVACY.md"

        self.assertTrue(rollback_playbook.exists(), f"Missing rollback playbook: {rollback_playbook}")
        self.assertTrue(retention_privacy.exists(), f"Missing data retention/privacy doc: {retention_privacy}")

        rollback_text = rollback_playbook.read_text(encoding="utf-8-sig")
        retention_text = retention_privacy.read_text(encoding="utf-8-sig")
        self.assertIn("Trigger Conditions", rollback_text)
        self.assertIn("Deletion Policy", retention_text)

    def test_release_gate_script_and_snapshot_exist(self):
        script = REPO_ROOT / "scripts" / "run_release_readiness.py"
        snapshot = REPO_ROOT / "data" / "eval" / "release_readiness_snapshot.json"

        self.assertTrue(script.exists(), f"Missing release readiness script: {script}")
        self.assertTrue(snapshot.exists(), f"Missing release readiness snapshot: {snapshot}")

        script_text = script.read_text(encoding="utf-8-sig")
        self.assertIn("evaluate_public_launch_readiness", script_text)
        self.assertIn("--fail-on-blocker", script_text)
        self.assertIn("rollback_strategy_tested", script_text)

    def test_ci_workflow_includes_release_gate(self):
        workflow = REPO_ROOT / ".github" / "workflows" / "quality-gates.yml"
        self.assertTrue(workflow.exists(), f"Missing workflow: {workflow}")

        content = workflow.read_text(encoding="utf-8-sig")
        self.assertIn("run_release_readiness.py", content)
        self.assertIn("--readiness-snapshot", content)
        self.assertIn("--fail-on-blocker", content)


if __name__ == "__main__":
    unittest.main()
