# Database Design — InterviewPrepApp

## F. Database Design

### Design Decisions

**Question Generation Strategy: Hybrid (Dynamic Generation + Seed Bank)**

For the POC, questions are **primarily generated dynamically by the LLM** based on role, skill area, difficulty, and interview context. This is the right choice because:

1. **Quality**: LLM-generated questions are contextual — they can follow up on previous answers, adjust difficulty, and avoid repetition naturally.
2. **Coverage**: We don't need to manually author hundreds of questions for 3 roles × 4 experience levels × multiple skill areas.
3. **Flexibility**: Adding a new role only requires defining its skill areas, not writing a question bank.
4. **Realism**: Real interviewers don't read from a script — they adapt. Dynamic generation replicates this.

However, we include a **seed question bank** (stored in the database) for:
- Warm-up / opening questions per role (predictable starting points)
- Fallback if LLM generation fails
- Future analytics (comparing AI-generated vs. curated questions)

**User Identity: Session-Based for POC**

No authentication in the POC. Users get a session token (UUID stored in browser localStorage). This is sufficient to link interview history. Authentication can be layered on later without schema changes — the `users` table already exists with an `email` field.

### Entity-Relationship Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email "nullable, unique"
        varchar display_name "nullable"
        timestamp created_at
        timestamp updated_at
    }

    roles {
        uuid id PK
        varchar slug UK "e.g. backend-developer"
        varchar name "e.g. Backend Developer"
        text description
        boolean is_active
        int display_order
        timestamp created_at
    }

    skills {
        uuid id PK
        varchar slug UK "e.g. python, sql, react"
        varchar name
        varchar category "e.g. language, framework, concept"
        timestamp created_at
    }

    role_skills {
        uuid id PK
        uuid role_id FK
        uuid skill_id FK
        int weight "importance 1-10 for this role"
        varchar difficulty_range "e.g. easy,medium,hard"
    }

    interview_sessions {
        uuid id PK
        uuid user_id FK
        uuid role_id FK
        varchar experience_level "fresher|junior|mid|senior"
        varchar difficulty "easy|medium|hard|adaptive"
        int duration_minutes "15|30|45"
        varchar status "configured|in_progress|completed|abandoned"
        jsonb focus_areas "selected skill slugs, nullable"
        int question_budget
        int questions_asked
        timestamp started_at "nullable"
        timestamp completed_at "nullable"
        timestamp created_at
        timestamp updated_at
    }

    interview_questions {
        uuid id PK
        uuid session_id FK
        uuid skill_id FK "nullable — AI may cross boundaries"
        int sequence_number
        text question_text
        varchar difficulty "easy|medium|hard"
        varchar question_type "initial|follow_up"
        uuid parent_question_id FK "self-ref, nullable, for follow-ups"
        jsonb metadata "generation context, prompt version"
        timestamp created_at
    }

    interview_answers {
        uuid id PK
        uuid question_id FK "unique — one answer per question"
        text answer_text
        int response_time_seconds "nullable"
        timestamp created_at
    }

    evaluations {
        uuid id PK
        uuid question_id FK "unique"
        uuid answer_id FK "unique"
        int technical_correctness "0-10"
        int conceptual_depth "0-10"
        int communication_clarity "0-10"
        int relevance "0-10"
        int problem_solving "0-10"
        int completeness "0-10"
        int overall_score "0-10"
        text strengths
        text weaknesses
        text feedback
        boolean follow_up_recommended
        varchar follow_up_reason "nullable"
        jsonb raw_evaluation "full LLM evaluation response"
        varchar prompt_version
        timestamp created_at
    }

    interview_reports {
        uuid id PK
        uuid session_id FK "unique"
        int overall_score "0-100"
        int technical_score "0-100"
        int communication_score "0-100"
        int problem_solving_score "0-100"
        int confidence_score "0-100"
        varchar readiness_level "not_ready|needs_work|almost_ready|ready|strong"
        jsonb strengths "string array"
        jsonb weaknesses "string array"
        jsonb recommendations "string array"
        jsonb recommended_topics "string array"
        jsonb category_breakdown "detailed per-category scores"
        text summary "narrative summary"
        jsonb raw_report "full LLM report response"
        varchar prompt_version
        timestamp created_at
    }

    seed_questions {
        uuid id PK
        uuid role_id FK
        uuid skill_id FK
        text question_text
        varchar difficulty "easy|medium|hard"
        varchar question_type "warmup|standard|advanced"
        boolean is_active
        timestamp created_at
    }

    users ||--o{ interview_sessions : "takes"
    roles ||--o{ interview_sessions : "for role"
    roles ||--o{ role_skills : "requires"
    skills ||--o{ role_skills : "belongs to"
    interview_sessions ||--o{ interview_questions : "contains"
    interview_questions ||--o| interview_answers : "answered by"
    interview_questions ||--o| evaluations : "evaluated as"
    interview_answers ||--o| evaluations : "evaluated"
    interview_sessions ||--o| interview_reports : "produces"
    interview_questions ||--o{ interview_questions : "follow-up to"
    roles ||--o{ seed_questions : "has seeds"
    skills ||--o{ seed_questions : "tests"
```

### Key Design Decisions

**1. Why `jsonb` for some fields?**
Fields like `focus_areas`, `strengths`, `weaknesses`, `recommendations` are arrays or semi-structured data that don't warrant their own tables at POC stage. PostgreSQL's `jsonb` provides indexed querying if needed later. These can be normalized into separate tables when the data model stabilizes.

**2. Why separate `evaluations` and `interview_reports`?**
Evaluations are per-question (granular, real-time). Reports are per-session (aggregated, generated once at completion). They serve different purposes and are generated at different times.

**3. Why `parent_question_id` on questions?**
Follow-up questions reference their parent. This creates a question tree that preserves the interview conversation structure, enabling the report to show "Question → Follow-up → Follow-up" chains.

**4. Why `prompt_version` on evaluations and reports?**
When we change prompts, evaluation quality may shift. Tracking which prompt version produced each evaluation enables comparison and quality assurance.

**5. Why `raw_evaluation` / `raw_report` jsonb fields?**
We store the full LLM response alongside the extracted/validated fields. This is essential for debugging, quality analysis, and prompt improvement — we can always re-parse old responses.

### Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `interview_sessions` | `(user_id, created_at DESC)` | User's interview history |
| `interview_sessions` | `(status)` | Find active/abandoned sessions |
| `interview_questions` | `(session_id, sequence_number)` | Ordered questions per session |
| `evaluations` | `(question_id)` | Lookup evaluation for a question |
| `interview_reports` | `(session_id)` | Lookup report for a session |
| `role_skills` | `(role_id, skill_id)` | Unique constraint |
| `seed_questions` | `(role_id, skill_id, difficulty)` | Question selection |

### Constraints

- `interview_answers.question_id` is UNIQUE (one answer per question)
- `evaluations.question_id` is UNIQUE (one evaluation per question)
- `interview_reports.session_id` is UNIQUE (one report per session)
- `role_skills.(role_id, skill_id)` is UNIQUE
- `roles.slug` is UNIQUE
- `skills.slug` is UNIQUE
- `interview_sessions.status` CHECK constraint on valid values
- `evaluations` score fields CHECK constraint: `0 <= score <= 10`
- `interview_reports` score fields CHECK constraint: `0 <= score <= 100`
