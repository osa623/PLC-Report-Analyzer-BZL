from fastapi import FastAPI

from common.logging_utils import configure_logging
from api.routes import router
from core.config import get_settings

settings = get_settings()
configure_logging(service_name=settings.service_name, log_level=settings.log_level)

app = FastAPI(title="balance_sheet_extractor", version="1.0.0")
app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.service_name}
