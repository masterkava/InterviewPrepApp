"""Service layer for interview session operations."""

import uuid as uuid_mod

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.models.interview import InterviewSession
from app.repositories.interview_repository import InterviewRepository
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.interview import (
    InterviewCreateRequest,
    InterviewCreateResponse,
    InterviewRoleInfo,
)


class InterviewService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session
        self._interview_repo = InterviewRepository(session)
        self._role_repo = RoleRepository(session)
        self._user_repo = UserRepository(session)

    async def create_interview(self, req: InterviewCreateRequest) -> InterviewCreateResponse:
        role = await self._role_repo.get_by_id(req.role_id)
        if role is None:
            raise NotFoundError("Role", str(req.role_id))
        if not role.is_active:
            raise ValidationError(f"Role '{role.name}' is not currently available")

        if req.user_id:
            user = await self._user_repo.get_by_id(req.user_id)
            if user is None:
                user = await self._user_repo.create(req.user_id)
        else:
            user = await self._user_repo.create()

        question_budget = self._compute_question_budget(req.duration_minutes)

        interview = InterviewSession(
            id=uuid_mod.uuid4(),
            user_id=user.id,
            role_id=role.id,
            experience_level=req.experience_level,
            difficulty=req.difficulty,
            duration_minutes=req.duration_minutes,
            status="configured",
            focus_areas=req.focus_areas,
            question_budget=question_budget,
            questions_asked=0,
        )
        await self._interview_repo.create(interview)
        await self._db.commit()

        return InterviewCreateResponse(
            id=interview.id,
            user_id=user.id,
            role=InterviewRoleInfo(id=role.id, name=role.name),
            experience_level=interview.experience_level,
            difficulty=interview.difficulty,
            duration_minutes=interview.duration_minutes,
            question_budget=question_budget,
            focus_areas=interview.focus_areas,
            status=interview.status,
            created_at=interview.created_at,
        )

    def _compute_question_budget(self, duration_minutes: int) -> int:
        return max(5, duration_minutes // 3)
