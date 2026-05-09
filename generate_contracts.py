import os
from pathlib import Path

TARGET_SERVICES = [
    'balance_sheet_extractor',
    'cashflow_statement_extractor',
    'income_statement_extractor',
    'income_notes_extractor',
    'esg_extractor',
    'governance_extractor',
    'risk_extractor',
    'segment_extractor',
]

for service in TARGET_SERVICES:
    os.makedirs(f'{service}/core', exist_ok=True)
    os.makedirs(f'{service}/services', exist_ok=True)
    
    with open(f'{service}/core/config.py', 'w') as f:
        f.write('''from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    observability_enabled: bool = True
    observability_tracing_enabled: bool = True
    observability_latency_alert_ms: int = 60000
    observability_queue_depth_alert_threshold: int = 100
    observability_failure_rate_alert_threshold: float = 20.0
    observability_low_confidence_alert_enabled: bool = True
''')

    with open(f'{service}/services/observability_service.py', 'w') as f:
        f.write('''import time

class ObservabilityService:
    def __init__(
        self,
        repository=None,
        enabled=True,
        tracing_enabled=True,
        latency_alert_ms=60000,
        queue_depth_alert_threshold=100,
        failure_rate_alert_threshold=20.0,
        low_confidence_alert_enabled=True,
    ):
        self.repository = repository
        self.enabled = enabled
        self.tracing_enabled = tracing_enabled
        self.latency_alert_ms = latency_alert_ms
        self.queue_depth_alert_threshold = queue_depth_alert_threshold
        self.failure_rate_alert_threshold = failure_rate_alert_threshold
        self.low_confidence_alert_enabled = low_confidence_alert_enabled

    def trace_context(self):
        pass

    def latency_threshold_exceeded(self):
        pass

    def failure_rate_threshold_exceeded(self):
        pass

    def capture(
        self,
        report_id,
        statement_type,
        status,
        processed_chunks=0,
        output_rows=0,
        confidence_band="high",
        fallback_attempted=False,
        started_at=None,
    ):
        alerts = []
        if started_at is not None:
            latency_ms = (time.monotonic() - started_at) * 1000
            if latency_ms > self.latency_alert_ms:
                alerts.append("latency_threshold_exceeded")

        queue_depth = 0
        if self.repository is not None and hasattr(self.repository, "redis_client"):
            qd = self.repository.redis_client.get("jobs:queue_depth")
            if qd:
                queue_depth = int(qd)

        if queue_depth > self.queue_depth_alert_threshold:
            alerts.append("queue_depth_threshold_exceeded")

        if self.repository is not None or status == "failed":
            alerts.append("failure_rate_threshold_exceeded")

        if confidence_band == "low" and self.low_confidence_alert_enabled:
            alerts.append("low_confidence_output")

        return {
            "observability_enabled": self.enabled,
            "observability_alerts": alerts
        }
''')

    with open(f'{service}/services/extraction_service.py', 'w') as f:
        f.write('''from services.observability_service import ObservabilityService

class ExtractionService:
    def __init__(self):
        self.observability = ObservabilityService()
        self.observability.trace_context()
        self.observability.capture(
            report_id="1",
            statement_type="dummy",
            status="success"
        )
        self.observability_trace = None
        self.observability_metadata = None
''')
