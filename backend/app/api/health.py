import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.schemas.health import HealthResponse

router = APIRouter()
logger = structlog.get_logger()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("health.database_check_failed", error=str(exc))
        db_status = "disconnected"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.app_version,
        database=db_status,
    )
