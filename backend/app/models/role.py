from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, BaseModel

if TYPE_CHECKING:
    pass


class Role(BaseModel):
    __tablename__ = "roles"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    role_skills: Mapped[list[RoleSkill]] = relationship(
        back_populates="role", lazy="selectin", cascade="all, delete-orphan"
    )
    seed_questions: Mapped[list[SeedQuestion]] = relationship(
        back_populates="role", lazy="noload"
    )


class Skill(BaseModel):
    __tablename__ = "skills"

    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)

    role_skills: Mapped[list[RoleSkill]] = relationship(
        back_populates="skill", lazy="noload"
    )


class RoleSkill(BaseModel):
    __tablename__ = "role_skills"
    __table_args__ = (
        UniqueConstraint("role_id", "skill_id", name="uq_role_skill"),
    )

    role_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False
    )
    weight: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    difficulty_range: Mapped[str] = mapped_column(
        String(50), default="easy,medium,hard", nullable=False
    )

    role: Mapped[Role] = relationship(back_populates="role_skills", lazy="joined")
    skill: Mapped[Skill] = relationship(back_populates="role_skills", lazy="joined")


class SeedQuestion(BaseModel):
    __tablename__ = "seed_questions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    question_type: Mapped[str] = mapped_column(String(20), nullable=False, default="standard")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    role: Mapped[Role] = relationship(back_populates="seed_questions", lazy="joined")
    skill: Mapped[Skill] = relationship(lazy="joined")
