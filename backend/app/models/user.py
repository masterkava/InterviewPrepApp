from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.interview import InterviewSession


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    interview_sessions: Mapped[list[InterviewSession]] = relationship(
        back_populates="user", lazy="selectin"
    )
