from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.interview import InterviewSession


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Profile
    user_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    years_of_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_profile_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Auth
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    refresh_token_jti: Mapped[str | None] = mapped_column(String(36), nullable=True)
    password_reset_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    interview_sessions: Mapped[list[InterviewSession]] = relationship(
        back_populates="user", lazy="selectin"
    )
