from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.interviews import router as interviews_router
from app.api.roles import router as roles_router
from app.api.users import router as users_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router, tags=["health"])
api_router.include_router(roles_router)
api_router.include_router(interviews_router)
api_router.include_router(users_router)
