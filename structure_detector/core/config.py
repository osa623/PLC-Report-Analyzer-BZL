from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "structure_detector"
    service_port: int = 8002
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_ttl_seconds: int = 900

    gemini_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
