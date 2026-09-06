"""Interview state dataclass for the engine."""

from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class QuestionRecord:
    question_id: UUID
    question_text: str
    skill_slug: str
    difficulty: str
    question_type: str
    answer_text: str | None = None
    overall_score: float | None = None
    follow_up_count: int = 0


@dataclass
class InterviewState:
    session_id: UUID
    role_name: str
    role_id: UUID
    experience_level: str
    difficulty: str
    question_budget: int
    questions_asked: int
    focus_areas: list[str]
    skill_weights: dict[str, int]
    questions: list[QuestionRecord] = field(default_factory=list)

    @property
    def remaining_budget(self) -> int:
        return self.question_budget - self.questions_asked

    @property
    def skills_covered(self) -> list[str]:
        return list({q.skill_slug for q in self.questions})

    @property
    def skills_remaining(self) -> list[str]:
        covered = set(self.skills_covered)
        all_skills = set(self.skill_weights.keys())
        if self.focus_areas:
            all_skills = {s for s in all_skills if s in self.focus_areas} | covered
        return [s for s in all_skills if s not in covered]

    @property
    def last_question(self) -> QuestionRecord | None:
        return self.questions[-1] if self.questions else None

    def follow_up_count_for_topic(self, skill_slug: str) -> int:
        return sum(
            1 for q in self.questions
            if q.skill_slug == skill_slug and q.question_type == "follow_up"
        )
