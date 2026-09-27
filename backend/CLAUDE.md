# Backend

FastAPI application serving the interview platform API.

## Layout

- `app/main.py` — FastAPI app creation, CORS, lifespan (runs seed on startup)
- `app/config.py` — Pydantic Settings from `.env` (database_url, openai_api_key, tts/llm models)
- `app/api/router.py` — mounts all route groups under `/api/v1`
- `app/db/session.py` — async SQLAlchemy engine + `get_db` dependency (auto-commits)
- `app/db/seed.py` — seeds roles, skills, and questions from `app/db/question_banks/*.json`
- `app/db/sync_questions.py` — syncs batch questions from `docs/question_bank/` directories

## API Routes

| Prefix | File | Purpose |
|--------|------|---------|
| `/api/v1/health` | `api/health.py` | Health check |
| `/api/v1/roles` | `api/roles.py` | List roles and skills |
| `/api/v1/interviews` | `api/interviews.py` | Start, answer, complete interviews + reports + history |
| `/api/v1/voice` | `api/voice.py` | TTS, STT, audio upload/serve |
| `/api/v1/admin` | `api/admin.py` | Sync question bank |
| `/api/v1/question-bank` | `api/question_bank.py` | Browse questions (read-only from JSON) |

## Database Models (app/models/)

- `User` — session-based users (auto-created)
- `Role`, `Skill`, `RoleSkill` — role definitions with weighted skills
- `SeedQuestion` — question bank stored in DB (synced from JSON files)
- `InterviewSession`, `InterviewAnswer`, `Evaluation` — interview state
- `InterviewReport` — generated score reports

## Testing

```bash
python -m pytest tests/ -v
```

- Uses SQLite in-memory for tests (`conftest.py` overrides `get_db`)
- Mock LLM provider auto-selected when no API key
- 31 tests covering API endpoints, scoring logic, and integration flows
- `asyncio_mode = "auto"` in `pyproject.toml`

## Important Conventions

- Never call `session.commit()` in API/service code — `get_db` handles it
- Use `session.flush()` when you need IDs before commit
- All models use `uuid.uuid4()` for primary keys
- Difficulty values: `easy`, `medium`, `hard` (normalized in sync)
- Voice: TTS audio cached in `uploads/audio/tts_cache/`, STT temp files auto-deleted
