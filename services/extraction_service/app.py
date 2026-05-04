from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="extraction-service", version="1.0.0")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "extraction-service", "status": "ok"}
