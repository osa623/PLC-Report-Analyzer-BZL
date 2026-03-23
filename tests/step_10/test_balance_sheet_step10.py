import json
import sys
import unittest
from pathlib import Path


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.counters: dict[str, int] = {}

    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = value
        return True

    def incr(self, key: str):
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    def incrby(self, key: str, amount: int):
        self.counters[key] = self.counters.get(key, 0) + amount
        return self.counters[key]

    def expire(self, key: str, seconds: int):
        return True


class _FakeRepository:
    def __init__(self) -> None:
        self.redis_client = _FakeRedis()


class TestStep10BalanceSheetGuardrails(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        repo_root = Path(__file__).resolve().parents[2]
        service_dir = repo_root / "balance_sheet_extractor"
        sys.path.insert(0, str(service_dir))
        sys.path.insert(1, str(repo_root))

        from core.config import Settings  # type: ignore
        from services.guardrails_service import ProcessingGuardrails  # type: ignore

        cls.Settings = Settings
        cls.ProcessingGuardrails = ProcessingGuardrails

    def test_guardrails_config_defaults_present(self):
        settings = self.Settings()

        self.assertTrue(settings.guardrails_enabled)
        self.assertEqual(settings.guardrails_max_chunks_per_report, 250)
        self.assertEqual(settings.guardrails_max_total_input_chars, 1500000)
        self.assertEqual(settings.guardrails_processing_timeout_seconds, 300)
        self.assertEqual(settings.guardrails_fallback_max_attempts_per_report, 20)
        self.assertTrue(settings.guardrails_usage_metering_enabled)

    def test_check_input_limits_rejects_large_chunk_count(self):
        repo = _FakeRepository()
        guardrails = self.ProcessingGuardrails(
            repository=repo,
            enabled=True,
            max_chunks_per_report=2,
            max_total_input_chars=1000,
        )

        chunks = [{"text_content": "a"}, {"text_content": "b"}, {"text_content": "c"}]
        allowed, state = guardrails.check_input_limits("r-10", chunks)

        self.assertFalse(allowed)
        self.assertTrue(state["guardrails_rejected"])
        self.assertEqual(state["guardrails_rejection_code"], "max_chunks_exceeded")

    def test_allow_fallback_attempt_enforces_budget(self):
        repo = _FakeRepository()
        guardrails = self.ProcessingGuardrails(
            repository=repo,
            enabled=True,
            fallback_max_attempts_per_report=1,
        )

        first_allowed, first_reason = guardrails.allow_fallback_attempt("r-11")
        second_allowed, second_reason = guardrails.allow_fallback_attempt("r-11")

        self.assertTrue(first_allowed)
        self.assertEqual(first_reason, "fallback_budget_available")
        self.assertFalse(second_allowed)
        self.assertEqual(second_reason, "fallback_budget_exhausted")


if __name__ == "__main__":
    unittest.main()
