from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None


if load_dotenv is not None:
    load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=False)


@dataclass
class ServiceConfig:
    service_name: str
    host: str
    port: int
    redis_url: str
    redis_ttl_seconds: int
    database_url: str
    log_level: str
    llm_model: str
    llm_api_key: str


def load_config(service_name: str, default_port: int) -> ServiceConfig:
    return ServiceConfig(
        service_name=service_name,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", str(default_port))),
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        redis_ttl_seconds=int(os.getenv("REDIS_TTL_SECONDS", "86400")),
        database_url=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/plc"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        llm_model=os.getenv("LLM_MODEL", "gemini-2.5-flash-lite"),
        llm_api_key=os.getenv("GOOGLE_API_KEY", ""),
    )
