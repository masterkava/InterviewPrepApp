# Technology Decisions — InterviewPrepApp

## L. Technology Decisions

### Frontend

#### React + TypeScript
**Why:** React is the most widely used frontend framework with the largest ecosystem, best hiring pool, and most mature tooling. TypeScript adds type safety that prevents bugs and improves developer experience with autocompletion.  
**Alternatives:** Vue.js (smaller ecosystem, fewer developers), Angular (heavier, slower for POC development), Svelte (excellent DX but smaller ecosystem, fewer available developers).  
**Decision:** React is the safe, productive choice. No downside for this project.

#### Vite (not Next.js)
**Why:** This is a single-page application that talks to a separate Python backend. We don't need SSR, ISR, or API routes. Vite provides instant HMR, fast builds, and zero configuration overhead.  
**Alternatives:** Next.js (adds SSR complexity we don't need, creates ambiguity about where API logic lives), Create React App (deprecated/unmaintained).  
**Decision:** Vite is faster, simpler, and sufficient. If we later need SSR (e.g., for SEO on a landing page), we can add it or migrate specific pages.

#### Tailwind CSS
**Why:** Fastest path to a polished UI for a small team. Utility-first means no context-switching between component files and CSS files. Built-in responsive utilities and design tokens.  
**Alternatives:** CSS Modules (more boilerplate, slower iteration), styled-components (runtime overhead, more code), Chakra UI (opinionated component library — useful but locks you in).  
**Decision:** Tailwind for speed. If we later want a component library, we can add shadcn/ui (Tailwind-based, copy-paste components) without changing the styling approach.

#### TanStack Query
**Why:** Handles server state management (caching, refetching, loading/error states) without a global state library. Eliminates most `useEffect` + `useState` data-fetching patterns.  
**Alternatives:** SWR (similar but less features), plain fetch + useState (more boilerplate, no caching), Redux Toolkit Query (overkill for this scale).  
**Decision:** TanStack Query is the standard for React data fetching. Lightweight, well-documented, eliminates boilerplate.

#### React Router v6
**Why:** Standard routing for React SPAs. Simple API, good TypeScript support.  
**Alternatives:** TanStack Router (newer, type-safe but less ecosystem adoption), Wouter (minimal, lacks features).  
**Decision:** React Router is the established choice. Stable, well-known.

### Backend

#### Python + FastAPI
**Why:** FastAPI provides automatic OpenAPI docs, Pydantic validation, async support, and excellent developer experience. Python is the natural choice for an AI-heavy application — all major AI/ML libraries are Python-first.  
**Alternatives:** Node.js/Express (we'd lose Python AI ecosystem advantage), Go (too low-level for rapid POC), Django (heavier, REST framework adds opinions we don't need).  
**Decision:** FastAPI is fast to develop, fast to run, and natural for AI integration.

#### SQLAlchemy 2.x
**Why:** The most mature Python ORM. Version 2.x brings modern async support and a cleaner API. Strong typing support. Large community.  
**Alternatives:** Tortoise ORM (async-native but smaller community, fewer features), raw SQL (faster for reads but more error-prone and harder to maintain), Prisma Python (immature).  
**Decision:** SQLAlchemy 2.x with async is production-proven and well-supported.

#### Pydantic v2
**Why:** Already integrated with FastAPI. Provides request/response validation, settings management, and LLM output validation — all in one library. v2 is significantly faster than v1.  
**Alternatives:** marshmallow (less integrated with FastAPI), attrs (less validation), dataclasses (no validation).  
**Decision:** Pydantic is the natural companion to FastAPI. Using it everywhere ensures consistency.

#### Alembic
**Why:** The standard migration tool for SQLAlchemy. Auto-generates migrations from model changes. Tracks migration history.  
**Alternatives:** manual SQL migrations (error-prone, no auto-generation), Yoyo (simpler but less SQLAlchemy integration).  
**Decision:** Alembic is the standard. No reason to deviate.

#### PostgreSQL 16
**Why:** The most capable open-source relational database. Excellent JSONB support (we use it for semi-structured evaluation data). Robust, reliable, production-proven.  
**Alternatives:** MySQL (weaker JSONB, weaker constraint support), SQLite (not suitable for concurrent writes in production), MongoDB (we have relational data — a document DB would fight us).  
**Decision:** PostgreSQL is the right choice for structured data with some semi-structured fields.

### AI

#### OpenAI API (initial provider)
**Why:** Most widely used, best-documented, most reliable API. GPT-4o provides strong evaluation quality. GPT-4o-mini provides fast, cheap question generation. Structured output mode reduces parsing errors.  
**Alternatives:** Anthropic Claude (excellent quality but structured output API is newer), Google Gemini (less proven for structured evaluation), open-source models via Ollama (quality concerns for evaluation, deployment complexity).  
**Decision:** Start with OpenAI for reliability and structured output maturity. The LLM provider abstraction means switching is a configuration change, not a rewrite.

#### Two-tier model strategy
**Why:** Not all AI operations need the same quality level. Question generation needs speed and creativity (gpt-4o-mini is sufficient). Answer evaluation needs precision and nuance (gpt-4o is worth the cost and latency).  
**Alternatives:** Single model for everything (either overpaying for generation or underperforming on evaluation).  
**Decision:** Use the right tool for each job. Configurable per operation.

### Infrastructure

#### Docker + Docker Compose
**Why:** One command (`docker-compose up`) starts the entire application. Consistent environment across developers. Easy to add services (Redis, etc.) later.  
**Alternatives:** Direct local installation (works but "it works on my machine" problems), Kubernetes (massive overkill for POC).  
**Decision:** Docker Compose is the sweet spot for POC development and deployment.

### Testing

#### pytest (backend)
**Why:** The standard Python testing framework. Excellent fixture system, plugin ecosystem, and async support.  
**Alternatives:** unittest (verbose, less featured).  
**Decision:** pytest is the obvious choice.

#### Vitest + React Testing Library (frontend)
**Why:** Vitest is Vite-native (same config, fast). React Testing Library encourages testing behavior over implementation details.  
**Alternatives:** Jest (slower, needs more configuration with Vite), Cypress (for E2E, not unit/component tests).  
**Decision:** Vitest for speed, RTL for best practices.

### What We Are NOT Using (and Why)

| Technology | Why Not |
|-----------|---------|
| Redis | No caching layer needed for POC. Interview state is in PostgreSQL. |
| Celery / task queue | Report generation can happen synchronously (< 15s). Async tasks add complexity. |
| WebSockets | Text-based Q&A works fine over REST. Real-time streaming can be added later if needed. |
| GraphQL | REST is simpler and sufficient. We don't have complex nested queries. |
| Terraform / IaC | No cloud infrastructure to manage for POC. |
| CI/CD pipeline | Can be added in Phase 8 polish. Manual deployment is fine for POC. |
| Authentication library | Session-based UUIDs for POC. Auth can be layered on later. |
| Monitoring (Datadog, etc.) | Structured logging to stdout is sufficient. Monitoring platforms come later. |
