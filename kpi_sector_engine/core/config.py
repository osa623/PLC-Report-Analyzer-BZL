from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "kpi_sector_engine"
    service_port: int = 8012
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ratios_suffix: str = "ratios"
    redis_sector_kpis_suffix: str = "sector_kpis"
    redis_ttl_seconds: int = 900

    benchmarks_file_path: str = "data/sector_benchmarks.json"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
