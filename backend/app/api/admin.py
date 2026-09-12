"""Admin API — question bank sync and management."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.sync_questions import SYNC_CONFIG, _migrate_seed_questions_table, sync_questions

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sync-questions")
async def sync_question_bank(
    directory: str | None = Query(None, description="Directory name to sync, e.g. 'BackendEngineer'"),
    clear: bool = Query(False, description="Clear existing questions before syncing"),
    db: AsyncSession = Depends(get_db),
):
    await _migrate_seed_questions_table()
    stats = await sync_questions(db, directory=directory, clear=clear)
    return {
        "status": "completed",
        "stats": stats,
        "available_directories": list(SYNC_CONFIG.keys()),
    }
