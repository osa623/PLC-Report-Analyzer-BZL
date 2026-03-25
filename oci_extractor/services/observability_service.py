import json
import time
from typing import Any

from repositories.report_repository import ReportRepository


class ObservabilityService:
    def __init__(
        self,
        repository: ReportRepository,
        enabled: bool = True,
        tracing_enabled: bool = True,
        latency_alert_ms: int = 60000,
        queue_depth_alert_threshold: int = 100,
        failure_rate_alert_threshold: float = 20.0,
        low_confidence_alert_enabled: bool = True,
    ) -> None:
        self.repository = repository
        self.enabled = enabled
        self.tracing_enabled = tracing_enabled
        self.latency_alert_ms = latency_alert_ms
        self.queue_depth_alert_threshold = queue_depth_alert_threshold
        self.failure_rate_alert_threshold = failure_rate_alert_threshold
        self.low_confidence_alert_enabled = low_confidence_alert_enabled

    @staticmethod
    def _hour_bucket() -> str:
        return time.strftime("%Y%m%d%H", time.gmtime())

    def trace_context(self, report_id: str, statement_type: str) -> dict[str, Any]:
        if not self.tracing_enabled:
            return {"observability_trace_id": None, "observability_tracing_enabled": False}

        trace_id = f"{statement_type}:{report_id}:{int(time.time() * 1000)}"
        return {
            "observability_trace_id": trace_id,
            "observability_tracing_enabled": True,
        }

    def _safe_get_int(self, key: str) -> int:
        raw = self.repository.redis_client.get(key)
        if raw is None:
            return 0
        try:
            return int(raw)
        except Exception:
            return 0

    def capture(
        self,
        report_id: str,
        statement_type: str,
        status: str,
        processed_chunks: int,
        output_rows: int,
        confidence_band: str,
        fallback_attempted: bool,
        started_at: float,
    ) -> dict[str, Any]:
        latency_ms = int((time.monotonic() - started_at) * 1000)
        queue_depth = self._safe_get_int("jobs:queue_depth")

        if not self.enabled:
            return {
                "observability_enabled": False,
                "observability_alerts": [],
                "observability_latency_ms": latency_ms,
                "observability_queue_depth": queue_depth,
                "observability_failure_rate_percent": 0.0,
                "observability_processed_chunks": processed_chunks,
                "observability_output_rows": output_rows,
                "observability_status": status,
                "observability_confidence_band": confidence_band,
                "observability_fallback_attempted": fallback_attempted,
            }

        hour = self._hour_bucket()
        req_key = f"obs:requests:{statement_type}:{hour}"
        fail_key = f"obs:failures:{statement_type}:{hour}"

        request_count = self.repository.redis_client.incr(req_key)
        if request_count == 1:
            self.repository.redis_client.expire(req_key, 3700)

        if status == "failed":
            failure_count = self.repository.redis_client.incr(fail_key)
            if failure_count == 1:
                self.repository.redis_client.expire(fail_key, 3700)
        else:
            failure_count = self._safe_get_int(fail_key)

        failure_rate = (failure_count / request_count * 100.0) if request_count else 0.0

        alerts: list[str] = []
        if latency_ms > self.latency_alert_ms:
            alerts.append("latency_threshold_exceeded")
        if queue_depth > self.queue_depth_alert_threshold:
            alerts.append("queue_depth_threshold_exceeded")
        if failure_rate > self.failure_rate_alert_threshold:
            alerts.append("failure_rate_threshold_exceeded")
        if self.low_confidence_alert_enabled and confidence_band == "low":
            alerts.append("low_confidence_output")

        snapshot = {
            "statement_type": statement_type,
            "status": status,
            "processed_chunks": processed_chunks,
            "output_rows": output_rows,
            "confidence_band": confidence_band,
            "fallback_attempted": fallback_attempted,
            "latency_ms": latency_ms,
            "queue_depth": queue_depth,
            "failure_rate_percent": failure_rate,
            "alerts": alerts,
        }
        try:
            self.repository.redis_client.set(
                f"obs:last:{report_id}:{statement_type}",
                json.dumps(snapshot),
                ex=24 * 3600,
            )
        except Exception:
            alerts.append("observability_snapshot_write_failed")

        return {
            "observability_enabled": True,
            "observability_alerts": alerts,
            "observability_latency_ms": latency_ms,
            "observability_queue_depth": queue_depth,
            "observability_failure_rate_percent": round(failure_rate, 2),
            "observability_processed_chunks": processed_chunks,
            "observability_output_rows": output_rows,
            "observability_status": status,
            "observability_confidence_band": confidence_band,
            "observability_fallback_attempted": fallback_attempted,
        }
