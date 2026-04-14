from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging
import os
try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

logger = logging.getLogger("platform_core.service_base")


def create_service(title: str = "service", version: str = "0.1") -> FastAPI:
    # Load local .env if available (safe no-op if python-dotenv not installed)
    if load_dotenv is not None:
        try:
            load_dotenv()
        except Exception:
            pass

    app = FastAPI(title=title, version=version)

    @app.get("/healthz")
    async def healthz():
        return JSONResponse({"status": "ok"})

    @app.get("/readyz")
    async def readyz():
        # placeholder readiness check
        return JSONResponse({"status": "ready"})

    return app


def run_uvicorn(app: FastAPI, host: str | None = None, port: int | None = None):
    import uvicorn

    host = host or os.environ.get("HOST", "0.0.0.0")
    port = port or int(os.environ.get("PORT", 8000))
    logger.info("Starting service on %s:%s", host, port)
    uvicorn.run(app, host=host, port=port)
