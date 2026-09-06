# Backend Architecture — InterviewPrepApp

## K. Backend Architecture

### Module Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     — FastAPI app factory, middleware, lifespan
│   ├── config.py                   — Settings from environment variables (Pydantic BaseSettings)
│   ├── dependencies.py             — Dependency injection (DB session, services)
│   │
│   ├── api/                        — HTTP layer (routes only, no business logic)
│   │   ├── __init__.py
│   │   ├── router.py               — Main API router (aggregates sub-routers)
│   │   ├── health.py               — GET /health
│   │   ├── roles.py                — GET /roles, GET /roles/{id}/skills
│   │   ├── interviews.py           — All /interviews endpoints
│   │   └── users.py                — GET /users/{id}/interviews
│   │
│   ├── schemas/                    — Pydantic request/response models
│   │   ├── __init__.py
│   │   ├── role.py                 — RoleResponse, SkillResponse
│   │   ├── interview.py            — CreateInterviewRequest, InterviewResponse, AnswerRequest, etc.
│   │   ├── evaluation.py           — EvaluationResponse, evaluation output schemas
│   │   └── report.py               — ReportResponse, score breakdowns
│   │
│   ├── models/                     — SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── base.py                 — Base model with id, created_at, updated_at
│   │   ├── user.py
│   │   ├── role.py                 — Role, Skill, RoleSkill
│   │   ├── interview.py            — InterviewSession, InterviewQuestion, InterviewAnswer
│   │   ├── evaluation.py           — Evaluation
│   │   ├── report.py               — InterviewReport
│   │   └── seed_question.py        — SeedQuestion
│   │
│   ├── repositories/               — Database access (queries, no business logic)
│   │   ├── __init__.py
│   │   ├── role_repository.py
│   │   ├── interview_repository.py
│   │   ├── question_repository.py
│   │   ├── evaluation_repository.py
│   │   └── report_repository.py
│   │
│   ├── services/                   — Business logic orchestration
│   │   ├── __init__.py
│   │   ├── interview_service.py    — Session lifecycle (create, start, complete, get)
│   │   ├── role_service.py         — Role/skill queries
│   │   └── user_service.py         — User creation/lookup
│   │
│   ├── interview/                  — Interview engine (core domain)
│   │   ├── __init__.py
│   │   ├── engine.py               — InterviewEngine: orchestration, state management, decision-making
│   │   ├── state.py                — InterviewState dataclass: tracks progress, skills, difficulty
│   │   ├── question_engine.py      — QuestionEngine: generates/selects questions
│   │   ├── answer_evaluator.py     — AnswerEvaluator: evaluates answers against rubric
│   │   └── report_generator.py     — ReportGenerator: aggregates scores, produces report
│   │
│   ├── ai/                         — AI/LLM layer
│   │   ├── __init__.py
│   │   ├── provider.py             — LLMProvider abstract base class
│   │   ├── openai_provider.py      — OpenAI implementation
│   │   ├── mock_provider.py        — Mock implementation for tests
│   │   ├── orchestrator.py         — AIOrchestrator: manages provider, retries, validation
│   │   └── schemas.py              — Pydantic models for LLM input/output validation
│   │
│   ├── prompts/                    — Versioned prompt templates
│   │   ├── __init__.py
│   │   ├── manager.py              — PromptManager: loads, caches, renders templates
│   │   └── v1/
│   │       ├── interviewer/
│   │       │   ├── system.txt
│   │       │   ├── question_generation.txt
│   │       │   ├── follow_up.txt
│   │       │   └── interview_close.txt
│   │       ├── evaluator/
│   │       │   ├── answer_evaluation.txt
│   │       │   └── rubric.txt
│   │       └── reporter/
│   │           └── report_generation.txt
│   │
│   └── db/                         — Database setup
│       ├── __init__.py
│       ├── session.py              — SQLAlchemy engine + session factory
│       └── seed.py                 — Seed data (roles, skills, role_skills)
│
├── alembic/                        — Database migrations
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 — Fixtures: test DB, mock LLM provider, test client
│   ├── unit/
│   │   ├── test_interview_engine.py
│   │   ├── test_question_engine.py
│   │   ├── test_answer_evaluator.py
│   │   ├── test_report_generator.py
│   │   ├── test_interview_state.py
│   │   └── test_ai_schemas.py
│   ├── api/
│   │   ├── test_health.py
│   │   ├── test_roles.py
│   │   └── test_interviews.py
│   └── integration/
│       └── test_interview_flow.py  — Full interview lifecycle test
│
├── pyproject.toml                  — Dependencies, tool config
├── Dockerfile
├── .env.example
└── README.md
```

### Layer Responsibilities

```
API Layer (app/api/)
  ↓ Depends on
Service Layer (app/services/)
  ↓ Depends on
Interview Engine (app/interview/)  +  Repository Layer (app/repositories/)
  ↓ Depends on                          ↓ Depends on
AI Layer (app/ai/)                     ORM Models (app/models/)
  ↓ Depends on                          ↓ Depends on
Prompt Manager (app/prompts/)          PostgreSQL
```

**Rules:**
- API layer: only HTTP concerns (request parsing, response serialization, status codes)
- Service layer: transaction boundaries, orchestrates domain operations
- Interview engine: pure domain logic, no HTTP or database awareness (receives/returns data objects)
- Repository layer: database queries, no business logic
- AI layer: LLM communication, no interview logic
- Prompt manager: template loading, no LLM communication

### Dependency Injection

FastAPI's `Depends()` system handles DI without a framework:

```python
# dependencies.py
def get_db() -> Generator[AsyncSession, None, None]:
    ...

def get_interview_service(db: AsyncSession = Depends(get_db)) -> InterviewService:
    llm_provider = get_llm_provider()  # from config
    ai_orchestrator = AIOrchestrator(llm_provider, prompt_manager)
    interview_engine = InterviewEngine(ai_orchestrator)
    return InterviewService(db, interview_engine)
```

### Configuration

```python
# config.py
class Settings(BaseSettings):
    # Database
    database_url: str
    
    # AI
    openai_api_key: str
    llm_model_evaluation: str = "gpt-4o"
    llm_model_generation: str = "gpt-4o-mini"
    llm_max_retries: int = 3
    llm_timeout_seconds: int = 30
    
    # Interview
    default_question_budget: int = 10
    max_follow_ups_per_topic: int = 2
    prompt_version: str = "v1"
    
    # App
    cors_origins: list[str] = ["http://localhost:5173"]
    log_level: str = "INFO"
    
    model_config = SettingsConfigDict(env_file=".env")
```

### Interview Engine Detail

The Interview Engine is the most important backend component. Its responsibilities:

```python
class InterviewEngine:
    """
    Orchestrates an interview session.
    Stateless — receives interview state, returns updated state + actions.
    """
    
    async def start_interview(self, session: InterviewSession) -> StartResult:
        """Generate introduction message + first question."""
    
    async def process_answer(
        self, 
        state: InterviewState, 
        question: InterviewQuestion, 
        answer_text: str
    ) -> AnswerResult:
        """
        1. Evaluate the answer
        2. Update state (skills covered, difficulty, etc.)
        3. Decide: follow-up, next topic, or interview complete
        4. Generate next question (if not complete)
        5. Return evaluation + next question + updated state
        """
    
    async def generate_report(
        self, 
        session: InterviewSession,
        questions: list[InterviewQuestion],
        evaluations: list[Evaluation]
    ) -> InterviewReport:
        """Aggregate scores + generate qualitative report."""
```

The engine is **stateless** — it doesn't hold interview state in memory. State is loaded from the database at the start of each request and written back after. This means:
- Server can restart without losing interview progress
- Multiple server instances could handle the same interview (future scaling)
- State is always consistent with the database

### Error Handling Strategy

```python
# Custom exception hierarchy
class AppError(Exception): ...
class NotFoundError(AppError): ...
class ConflictError(AppError): ...      # e.g., interview already started
class ValidationError(AppError): ...
class AIError(AppError): ...            # LLM failures after retries

# Mapped to HTTP status codes in a single exception handler
@app.exception_handler(AppError)
async def handle_app_error(request, exc):
    status_map = {
        NotFoundError: 404,
        ConflictError: 409,
        ValidationError: 422,
        AIError: 503,
    }
    ...
```

### Logging Strategy

```python
import structlog

logger = structlog.get_logger()

# Interview lifecycle events
logger.info("interview.started", session_id=session_id, role=role_name)
logger.info("question.generated", session_id=session_id, sequence=n, skill=skill, difficulty=difficulty)
logger.info("answer.received", session_id=session_id, sequence=n, response_time_seconds=45)
logger.info("evaluation.completed", session_id=session_id, sequence=n, overall_score=7)
logger.info("interview.completed", session_id=session_id, questions_asked=10)
logger.info("report.generated", session_id=session_id, overall_score=72)

# AI operations
logger.info("llm.call", operation="evaluation", model="gpt-4o", tokens_used=1500, latency_ms=2300)
logger.warning("llm.retry", operation="evaluation", attempt=2, reason="schema_validation_failed")
logger.error("llm.failed", operation="evaluation", attempts=3, error="timeout")
```

Candidate answer text is stored in the database but NOT logged — logs may be shipped to external services.
