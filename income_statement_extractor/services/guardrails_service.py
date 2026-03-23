import json
import time
from typing import Any

from repositories.report_repository import ReportRepository


class ProcessingGuardrails:
    def __init__(
        self,
        repository: ReportRepository,
        enabled: bool = True,
        max_chunks_per_report: int = 250,
        max_total_input_chars: int = 1_500_000,
        processing_timeout_seconds: int = 300,
        fallback_max_attempts_per_report: int = 20,
        usage_metering_enabled: bool = True,
        per_user_reports_per_hour: int = 200,
        per_ip_reports_per_hour: int = 400,
    ) -> None:
        self.repository = repository
        self.enabled = enabled
        self.max_chunks_per_report = max_chunks_per_report
        self.max_total_input_chars = max_total_input_chars
        self.processing_timeout_seconds = processing_timeout_seconds
        self.fallback_max_attempts_per_report = fallback_max_attempts_per_report
        self.usage_metering_enabled = usage_metering_enabled
        self.per_user_reports_per_hour = per_user_reports_per_hour
        self.per_ip_reports_per_hour = per_ip_reports_per_hour

    @staticmethod
    def _hour_bucket() -> str:
        return time.strftime("%Y%m%d%H", time.gmtime())

    @staticmethod
    def _input_chars(chunks: list[dict[str, Any]]) -> int:
        return sum(len(str(chunk.get("text_content", ""))) for chunk in chunks if isinstance(chunk, dict))

    def _request_context(self, report_id: str) -> dict[str, Any]:
        key = f"report:{report_id}:request_context"
        raw = self.repository.redis_client.get(key)
        if not raw:
            return {}
        try:
            payload = json.loads(raw)
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def check_input_limits(self, report_id: str, chunks: list[dict[str, Any]]) -> tuple[bool, dict[str, Any]]:
        state = {
            "guardrails_enabled": self.enabled,
            "guardrails_rejected": False,
            "guardrails_rejection_code": None,
            "guardrails_input_chunk_count": len(chunks),
            "guardrails_input_total_chars": self._input_chars(chunks),
            "guardrails_user_rate_limited": False,
            "guardrails_ip_rate_limited": False,
        }

        if not self.enabled:
            return True, state

        if len(chunks) > self.max_chunks_per_report:
            state["guardrails_rejected"] = True
            state["guardrails_rejection_code"] = "max_chunks_exceeded"
            return False, state

        if state["guardrails_input_total_chars"] > self.max_total_input_chars:
            state["guardrails_rejected"] = True
            state["guardrails_rejection_code"] = "max_input_chars_exceeded"
            return False, state

        context = self._request_context(report_id)
        user_id = str(context.get("user_id") or "").strip()
        ip_address = str(context.get("ip_address") or context.get("client_ip") or "").strip()

        hour_bucket = self._hour_bucket()

        if user_id:
            user_key = f"guardrails:rate:user:{user_id}:{hour_bucket}"
            user_count = self.repository.redis_client.incr(user_key)
            if user_count == 1:
                self.repository.redis_client.expire(user_key, 3700)
            if user_count > self.per_user_reports_per_hour:
                state["guardrails_rejected"] = True
                state["guardrails_rejection_code"] = "user_rate_limit_exceeded"
                state["guardrails_user_rate_limited"] = True
                return False, state

        if ip_address:
            ip_key = f"guardrails:rate:ip:{ip_address}:{hour_bucket}"
            ip_count = self.repository.redis_client.incr(ip_key)
            if ip_count == 1:
                self.repository.redis_client.expire(ip_key, 3700)
            if ip_count > self.per_ip_reports_per_hour:
                state["guardrails_rejected"] = True
                state["guardrails_rejection_code"] = "ip_rate_limit_exceeded"
                state["guardrails_ip_rate_limited"] = True
                return False, state

        return True, state

    def allow_fallback_attempt(self, report_id: str) -> tuple[bool, str]:
        if not self.enabled:
            return True, "guardrails_disabled"

        key = f"guardrails:fallback_attempts:{report_id}"
        count = self.repository.redis_client.incr(key)
        if count == 1:
            self.repository.redis_client.expire(key, 24 * 3600)

        if count > self.fallback_max_attempts_per_report:
            return False, "fallback_budget_exhausted"

        return True, "fallback_budget_available"

    def exceeded_timeout(self, started_at: float) -> bool:
        if not self.enabled:
            return False
        return (time.monotonic() - started_at) > self.processing_timeout_seconds

    def usage_metadata(
        self,
        report_id: str,
        statement_type: str,
        status: str,
        output_rows: int,
        guardrail_state: dict[str, Any],
        fallback_attempted: bool,
    ) -> dict[str, Any]:
        metadata = {
            "usage_metering_enabled": self.usage_metering_enabled,
            "usage_statement_type": statement_type,
            "usage_status": status,
            "usage_output_rows": output_rows,
            "usage_input_chunk_count": guardrail_state.get("guardrails_input_chunk_count", 0),
            "usage_input_total_chars": guardrail_state.get("guardrails_input_total_chars", 0),
            "usage_fallback_attempted": fallback_attempted,
        }

        if not self.usage_metering_enabled:
            return metadata

        try:
            self.repository.redis_client.incr("guardrails:usage:reports_total")
            self.repository.redis_client.incrby(
                "guardrails:usage:input_chars_total",
                int(metadata["usage_input_total_chars"]),
            )
            self.repository.redis_client.incrby(
                f"guardrails:usage:output_rows:{statement_type}",
                int(output_rows),
            )
            self.repository.redis_client.incr(f"guardrails:usage:status:{status}")
            self.repository.redis_client.set(
                f"guardrails:usage:last_report:{report_id}:{statement_type}",
                json.dumps(metadata),
                ex=24 * 3600,
            )
        except Exception:
            metadata["usage_metering_enabled"] = False

        return metadata
