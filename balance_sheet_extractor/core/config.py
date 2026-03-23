from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "balance_sheet_extractor"
    service_port: int = 8004
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ttl_seconds: int = 900

    gemini_api_key: str = ""
    gemini_model_name: str = "gemini-2.0-flash"
    gemini_model_alias: Literal["fast", "balanced", "quality"] = "fast"
    gemini_fallback_models: str = "gemini-2.0-flash,gemini-1.5-flash"
    gemini_temperature: float = 0.0
    gemini_max_retries: int = 2
    fallback_provider: Literal["none", "document_ai", "azure_di"] = "none"
    fallback_enabled: bool = False
    fallback_kill_switch: bool = False
    fallback_on_low_confidence: bool = True
    confidence_routing_enabled: bool = True
    confidence_routing_fallback_on_medium: bool = False
    confidence_routing_fail_on_low: bool = True
    guardrails_enabled: bool = True
    guardrails_max_chunks_per_report: int = 250
    guardrails_max_total_input_chars: int = 1500000
    guardrails_processing_timeout_seconds: int = 300
    guardrails_fallback_max_attempts_per_report: int = 20
    guardrails_usage_metering_enabled: bool = True
    guardrails_per_user_reports_per_hour: int = 200
    guardrails_per_ip_reports_per_hour: int = 400

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
