from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "comparative_analysis"
    service_port: int = 8015
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ratios_suffix: str = "ratios"
    redis_patterns_suffix: str = "patterns"
    redis_final_report_suffix: str = "final_report"
    redis_comparative_suffix: str = "comparative"
    redis_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
