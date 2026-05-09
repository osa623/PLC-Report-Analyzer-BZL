class BaseSettings:
    pass

class Settings(BaseSettings):
    observability_enabled: bool = True
    observability_tracing_enabled: bool = True
    observability_latency_alert_ms: int = 60000
    observability_queue_depth_alert_threshold: int = 100
    observability_failure_rate_alert_threshold: float = 20.0
    observability_low_confidence_alert_enabled: bool = True
