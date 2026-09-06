from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.db.seed import seed_data
from app.db.session import async_session_factory, engine
from app.exceptions import AppError, app_error_handler
from app.logging_config import setup_logging
from app.models import Base

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    logger.info("app.starting", version=settings.app_version)
    if settings.database_url.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("db.tables_created", dialect="sqlite")
    try:
        async with async_session_factory() as session:
            await seed_data(session)
    except Exception as exc:
        logger.warning("seed.failed", error=str(exc))
    yield
    logger.info("app.shutting_down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="InterviewPrepApp API",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)
    app.include_router(api_router)

    return app


app = create_app()
