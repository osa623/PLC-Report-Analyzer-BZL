from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "governance_extractor"
    service_port: int = 8008
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_key_suffix: str = "governance"
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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
