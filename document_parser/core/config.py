from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "document_parser"
    service_port: int = 8001
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    redis_url: str = "redis://redis:6379/0"
    redis_key_prefix: str = "report"
    redis_document_chunks_suffix: str = "document_chunks"
    redis_ttl_seconds: int = 900

    max_pages_per_chunk: int = 3

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
