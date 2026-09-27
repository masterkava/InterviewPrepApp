# InterviewPrepApp

AI-powered mock interview platform. Users pick a role, answer adaptive questions (text or voice), get evaluated, and receive a scored report.

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, structlog
- **Frontend**: React 18, TypeScript, Vite, React Router v6
- **Database**: SQLite locally (async via aiosqlite), PostgreSQL in prod (asyncpg)
- **AI**: OpenAI API — GPT-4o for evaluation, GPT-4o-mini for generation, Whisper for STT, TTS-1 for text-to-speech
- **Testing**: pytest + pytest-asyncio (backend), no frontend tests yet

## Project Structure

```
backend/           # FastAPI app (runs on :8000)
  app/
    api/           # Route handlers (health, roles, interviews, voice, admin, question_bank)
    ai/            # LLM provider abstraction (OpenAI + Mock)
    db/            # Session, seed data, sync_questions
    interview/     # Core engine: adaptive questions, evaluation, reports
    models/        # SQLAlchemy ORM models
    prompts/       # Jinja2 prompt templates
    repositories/  # Data access layer
    schemas/       # Pydantic request/response models
    services/      # Business logic layer
  tests/           # pytest test suite (31 tests)
frontend/          # React SPA (runs on :5173, proxies /api to :8000)
  src/
    pages/         # Route pages (Setup, Lobby, Interview, Voice, Report, History, QuestionBank)
    components/    # Shared components
    services/      # API client (api.ts)
    types/         # TypeScript types
mobile/            # React Native app (Expo SDK 57, TypeScript)
  src/
    screens/       # Screen components (same flows as web)
    navigation/    # React Navigation stack
    services/      # API client (adapted from web)
    types/         # TypeScript types (shared with web)
    constants/     # Theme tokens + API config
    hooks/         # useSessionId (AsyncStorage)
docs/question_bank/  # Batch JSON question files (schema v2)
```

## Running the App

```bash
# Backend
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Common Commands

```bash
# Run backend tests
cd backend && python -m pytest tests/ -v

# Sync question bank to DB
cd backend && python -m app.db.sync_questions

# Sync specific role
cd backend && python -m app.db.sync_questions BackendEngineer --clear
```

## Key Patterns

- **Async everywhere**: all DB operations use `async/await` with SQLAlchemy async sessions
- **Auto-commit via `get_db`**: the FastAPI dependency `get_db()` auto-commits on success — don't call `session.commit()` in service/API code
- **LLM provider abstraction**: `app/ai/provider.py` defines the interface; `openai_provider.py` and `mock_provider.py` implement it; `factory.py` selects based on config
- **Adaptive interview engine**: `app/interview/adaptive_engine.py` picks questions from the seed bank based on skill coverage and difficulty progression
- **Question bank sync**: `app/db/sync_questions.py` loads batch JSON files from `docs/question_bank/<RoleName>/` into the DB with deduplication by `source_id`

## Environment

- `.env` in `backend/` — contains `OPENAI_API_KEY` (never commit this)
- Frontend Vite proxy: `/api/*` forwards to `localhost:8000` (configured in `vite.config.ts`)
- SQLite DB file: `backend/interviewprep.db` (auto-created, gitignored)

## Roles & Skills

Currently 4 roles: Python Developer, AI/ML Engineer, Full Stack Developer, Backend Engineer. Each role has weighted skills that drive adaptive question selection.
