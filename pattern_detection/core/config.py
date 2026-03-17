from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "pattern_detection"
    service_port: int = 8013
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ratios_suffix: str = "ratios"
    redis_patterns_suffix: str = "patterns"
    redis_risk_suffix: str = "risk"
    redis_strategy_suffix: str = "strategy"
    redis_ttl_seconds: int = 900

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
