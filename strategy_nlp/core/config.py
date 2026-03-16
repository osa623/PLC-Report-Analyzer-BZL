from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "strategy_nlp"
    service_port: int = 8011
    database_url: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/cse_finance"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
