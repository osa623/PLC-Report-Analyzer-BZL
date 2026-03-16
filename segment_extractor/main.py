from fastapi import FastAPI

from api.routes import router
from core.config import get_settings

settings = get_settings()
app = FastAPI(title="segment_extractor", version="1.0.0")
app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.service_name}
