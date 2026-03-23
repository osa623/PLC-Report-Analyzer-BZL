import ast
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
TARGET_SERVICES = [
    "cashflow_statement_extractor",
    "income_statement_extractor",
    "income_notes_extractor",
    "esg_extractor",
    "governance_extractor",
    "risk_extractor",
    "segment_extractor",
]


class TestStep02RolloutContracts(unittest.TestCase):
    def _parse(self, path: Path) -> ast.Module:
        source = path.read_text(encoding="utf-8-sig")
        return ast.parse(source)

    def _function_names(self, tree: ast.Module) -> set[str]:
        return {node.name for node in tree.body if isinstance(node, ast.FunctionDef)}

    def _class_names(self, tree: ast.Module) -> set[str]:
        return {node.name for node in tree.body if isinstance(node, ast.ClassDef)}

    def _decorator_paths(self, tree: ast.Module) -> set[str]:
        paths = set()
        for node in tree.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call):
                    continue
                if not decorator.args:
                    continue
                first = decorator.args[0]
                if isinstance(first, ast.Constant) and isinstance(first.value, str):
                    paths.add(first.value)
        return paths

    def test_job_service_added_to_all_target_services(self):
        required_methods = {
            "submit_job",
            "process_parent_job",
            "get_parent_with_children",
        }
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "services" / "job_service.py"
                self.assertTrue(path.exists(), f"Missing job service: {path}")
                tree = self._parse(path)
                class_names = self._class_names(tree)
                self.assertIn("JobService", class_names)
                method_names = {
                    node.name
                    for node in tree.body
                    if isinstance(node, ast.ClassDef) and node.name == "JobService"
                    for node in node.body
                    if isinstance(node, ast.FunctionDef)
                }
                for method in required_methods:
                    self.assertIn(method, method_names)

    def test_dependencies_expose_get_job_service(self):
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "core" / "dependencies.py"
                self.assertTrue(path.exists(), f"Missing dependencies module: {path}")
                tree = self._parse(path)
                function_names = self._function_names(tree)
                self.assertIn("get_job_service", function_names)

    def test_routes_expose_async_job_endpoints(self):
        required_paths = {"/jobs/submit", "/jobs/{parent_job_id}"}
        required_functions = {"submit_async_jobs", "get_parent_job_status"}
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "api" / "routes.py"
                self.assertTrue(path.exists(), f"Missing routes module: {path}")
                tree = self._parse(path)
                function_names = self._function_names(tree)
                decorator_paths = self._decorator_paths(tree)
                for function_name in required_functions:
                    self.assertIn(function_name, function_names)
                for route_path in required_paths:
                    self.assertIn(route_path, decorator_paths)

    def test_schemas_include_async_job_models(self):
        required_classes = {
            "AsyncJobSubmitRequest",
            "ChildJobSummary",
            "AsyncJobSubmitResponse",
            "ChildJobStatus",
            "ParentJobStatusResponse",
        }
        for service in TARGET_SERVICES:
            with self.subTest(service=service):
                path = REPO_ROOT / service / "models" / "schemas.py"
                self.assertTrue(path.exists(), f"Missing schemas module: {path}")
                tree = self._parse(path)
                class_names = self._class_names(tree)
                for class_name in required_classes:
                    self.assertIn(class_name, class_names)


if __name__ == "__main__":
    unittest.main()
