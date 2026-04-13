from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class ServiceMetadata:
    name: str
    version: str = "1.0.0"
    description: str = ""
    tags: list[str] = field(default_factory=list)


def create_service_app(
    metadata: ServiceMetadata,
    *,
    settings_provider: Callable[[], Any] | None = None,
    extra_routers: list[Any] | None = None,
) -> FastAPI:
    """Create a standardized FastAPI app for all Python microservices."""
    app = FastAPI(
        title=metadata.name,
        version=metadata.version,
        description=metadata.description,
        openapi_tags=[{"name": tag} for tag in metadata.tags],
    )

    app.state.service_metadata = metadata
    app.state.container = {}

    if settings_provider is not None:
        app.state.settings = settings_provider()

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": metadata.name,
            "version": metadata.version,
        }

    @app.get("/metadata", tags=["system"])
    def service_metadata() -> dict[str, Any]:
        return {
            "name": metadata.name,
            "version": metadata.version,
            "description": metadata.description,
            "tags": metadata.tags,
        }

    @app.exception_handler(HTTPException)
    async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": "http_error",
                    "detail": exc.detail,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "detail": str(exc),
                }
            },
        )

    for router in extra_routers or []:
        app.include_router(router)

    return app
