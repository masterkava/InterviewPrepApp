"""Mock LLM provider for testing."""

from app.ai.provider import LLMProvider, T
from app.ai.schemas import EvaluationOutput, FollowUpOutput, QuestionGenerationOutput


MOCK_QUESTIONS = [
    QuestionGenerationOutput(
        question_text="Can you explain what a RESTful API is and what makes an API 'RESTful'?",
        difficulty="easy",
        skill_area="rest-apis",
        reasoning="Starting with foundational API concepts for a junior candidate.",
    ),
    QuestionGenerationOutput(
        question_text="What are Python decorators and how would you use them?",
        difficulty="medium",
        skill_area="python",
        reasoning="Testing Python language fundamentals.",
    ),
    QuestionGenerationOutput(
        question_text="Explain the difference between SQL JOIN types with examples.",
        difficulty="medium",
        skill_area="sql",
        reasoning="Testing database query knowledge.",
    ),
    QuestionGenerationOutput(
        question_text="What is database indexing and when would you use it?",
        difficulty="medium",
        skill_area="databases",
        reasoning="Testing database optimization knowledge.",
    ),
    QuestionGenerationOutput(
        question_text="How does HTTP caching work? What are the main cache headers?",
        difficulty="medium",
        skill_area="http",
        reasoning="Testing HTTP protocol knowledge.",
    ),
]

MOCK_FOLLOW_UP = FollowUpOutput(
    question_text="Can you elaborate on how statelessness in REST affects scalability?",
    difficulty="medium",
    follow_up_purpose="probe_deeper",
)

MOCK_EVALUATION = EvaluationOutput(
    technical_correctness=7.0,
    conceptual_depth=6.0,
    communication_clarity=7.0,
    relevance=8.0,
    problem_solving=6.0,
    completeness=6.0,
    overall_score=7.0,
    strengths=["Clear explanation of core concepts", "Good use of examples"],
    weaknesses=["Could go deeper into trade-offs", "Missing edge cases"],
    feedback="Good foundational understanding. To improve, discuss trade-offs and real-world implications.",
    follow_up_recommended=False,
    follow_up_reason=None,
)


class MockProvider(LLMProvider):
    def __init__(self) -> None:
        self._question_index = 0

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        output_schema: type[T],
        model: str | None = None,
    ) -> T:
        if output_schema is QuestionGenerationOutput:
            idx = self._question_index % len(MOCK_QUESTIONS)
            self._question_index += 1
            return MOCK_QUESTIONS[idx]  # type: ignore[return-value]

        if output_schema is FollowUpOutput:
            return MOCK_FOLLOW_UP  # type: ignore[return-value]

        if output_schema is EvaluationOutput:
            return MOCK_EVALUATION  # type: ignore[return-value]

        raise ValueError(f"MockProvider does not support schema: {output_schema}")
