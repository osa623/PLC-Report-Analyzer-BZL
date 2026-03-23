import ast
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
TARGET_SERVICES = [
    "balance_sheet_extractor",
    "cashflow_statement_extractor",
    "income_statement_extractor",
    "income_notes_extractor",
    "esg_extractor",
    "governance_extractor",
    "risk_extractor",
    "segment_extractor",
]


class TestStep03RolloutContracts(unittest.TestCase):
    def _parse(self, path: Path) -> ast.Module:
        source = path.read_text(encoding="utf-8-sig")
        return ast.parse(source)

    def _class_node(self, tree: ast.Module, class_name: str) -> ast.ClassDef:
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                return node
        raise AssertionError(f"Class {class_name} not found")

    def test_job_services_define_dead_letter_constants_and_constructor_knob(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "job_service.py"
                self.assertTrue(path.exists(), f"Missing job service: {path}")
                tree = self._parse(path)

                constant_names = {
                    node.targets[0].id
                    for node in tree.body
                    if isinstance(node, ast.Assign)
                    and len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name)
                }
                self.assertIn("DEFAULT_MAX_ATTEMPTS", constant_names)
                self.assertIn("DEAD_LETTER_STATUS", constant_names)

                job_service = self._class_node(tree, "JobService")
                init_methods = [n for n in job_service.body if isinstance(n, ast.FunctionDef) and n.name == "__init__"]
                self.assertEqual(len(init_methods), 1)
                init_args = [a.arg for a in init_methods[0].args.args]
                self.assertIn("max_attempts", init_args)

    def test_job_services_include_retry_and_dead_letter_fields(self):
        required_snippets = [
            '"attempts"',
            '"max_attempts"',
            '"dead_lettered_at"',
            '"dead_letter_count"',
            "_mark_child_dead_letter",
            "DEAD_LETTER_STATUS",
        ]
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "job_service.py"
                source = path.read_text(encoding="utf-8-sig")
                for snippet in required_snippets:
                    self.assertIn(snippet, source)

    def test_schemas_allow_dead_letter_status(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "models" / "schemas.py"
                self.assertTrue(path.exists(), f"Missing schema file: {path}")
                source = path.read_text(encoding="utf-8-sig")
                self.assertIn('"dead_letter"', source)


if __name__ == "__main__":
    unittest.main()
