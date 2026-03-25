from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "report_generator"
    service_port: int = 8014
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ratios_suffix: str = "ratios"
    redis_patterns_suffix: str = "patterns"
    redis_final_report_suffix: str = "final_report"
    redis_ttl_seconds: int = 3600
    report_output_dir: str = "generated_reports"
    pattern_min_confidence: float = 0.35

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
