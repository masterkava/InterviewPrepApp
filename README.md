# InterviewPrepApp

AI-powered mock interview platform that simulates real technical interviews, evaluates candidate answers with a structured rubric, and generates detailed performance reports.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional for local dev) Python 3.11+, Node.js 20+

### Run with Docker Compose

```bash
# Clone and enter the project
cd InterviewPrepApp

# Copy environment files
cp backend/.env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY

# Start all services
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/v1/health

### Local Development (without Docker)

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env
# Edit .env with your database URL and API keys

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api to backend)
npm run dev
```

#### PostgreSQL

Start PostgreSQL locally or via Docker:

```bash
docker run -d --name interviewprep-db \
  -e POSTGRES_DB=interviewprep \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend (coming in later phases)
cd frontend
npm test
```

## Project Structure

```
InterviewPrepApp/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level pages
│   │   ├── services/     # API client
│   │   └── ...
│   └── ...
├── backend/           # Python + FastAPI
│   ├── app/
│   │   ├── api/          # HTTP endpoints
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response models
│   │   ├── services/     # Business logic
│   │   ├── interview/    # Interview engine (core domain)
│   │   ├── ai/           # LLM provider abstraction
│   │   ├── prompts/      # Versioned prompt templates
│   │   └── db/           # Database setup
│   ├── alembic/          # Database migrations
│   └── tests/
├── docs/              # Architecture & design documents
└── docker-compose.yml
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router v7 |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic |
| Database | PostgreSQL 16 |
| AI | OpenAI API (gpt-4o / gpt-4o-mini) with provider abstraction |
| Infrastructure | Docker Compose |
