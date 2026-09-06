# Product Requirements — InterviewPrepApp

## A. Product Definition

### Problem Statement
Candidates preparing for technical interviews lack access to realistic, structured mock interview practice with actionable feedback. The current alternatives are:
- **Peer mock interviews** — hard to schedule, inconsistent quality, no structured evaluation
- **ChatGPT / generic AI** — no interview simulation, no context maintenance, no structured scoring, no progression
- **Paid coaching** — expensive ($50–200/session), limited availability, not scalable
- **Self-study** — no feedback loop, no way to assess readiness, no practice under pressure

The result: candidates fail multiple real interviews before they develop the skills they could have practiced beforehand.

### Target Users

**Persona 1: Fresh Graduate / Student**
- Age: 20–25
- Preparing for first technical job
- Has theoretical knowledge but limited interview experience
- Doesn't know what to expect in interviews
- Needs confidence building and structured practice
- Price-sensitive

**Persona 2: Working Professional**
- Age: 25–40
- Switching roles or companies
- Has practical experience but may be rusty on fundamentals
- Needs to identify gaps in knowledge
- Limited time for preparation
- Willing to pay for effective tools

### Value Proposition
"Practice technical interviews with an AI that behaves like a real interviewer — get scored, get feedback, get ready."

Key differentiators from using ChatGPT directly:
1. **Structured interview simulation** — not a chatbot conversation
2. **Adaptive questioning** — difficulty adjusts based on performance
3. **Contextual follow-ups** — like a real interviewer probing deeper
4. **Structured evaluation** — rubric-based scoring, not arbitrary feedback
5. **Actionable report** — specific strengths, weaknesses, and study recommendations
6. **Interview readiness assessment** — "are you actually ready?"

### MVP Scope (POC)

**In Scope:**
- Landing page with clear value proposition
- Role selection (3 roles: Backend Developer, AI/ML Developer, Full Stack Developer)
- Experience level selection (Fresher, Junior 1-2yr, Mid 3-5yr, Senior 5+yr)
- Interview configuration (difficulty, duration, focus areas)
- AI-conducted interview with 8–15 questions per session
- Text-based Q&A (type answers)
- Contextual follow-up questions
- Adaptive difficulty progression
- Per-answer evaluation
- End-of-interview comprehensive report
- Score breakdown (technical, communication, problem-solving)
- Strengths, weaknesses, and recommendations
- Interview history (view past interviews)

**Explicitly Out of Scope (POC):**
- User authentication / accounts (use anonymous sessions or simple email)
- Payment / subscription
- Voice input/output (STT/TTS)
- AI avatar (beyond a static visual representation)
- Video interviews
- Coding challenges with code execution
- System design whiteboard
- Behavioral interviews
- Resume-based interview customization
- Job-description-based interviews
- Mobile app
- Social features
- Admin panel
- Analytics dashboard
- Multi-language support
- Real-time collaboration
- Enterprise features

## B. User Journey

### Primary Journey: Take a Mock Interview

```
1. DISCOVER
   User lands on the application
   → Sees value proposition: "Practice. Get evaluated. Become interview ready."
   → Sees supported roles and what the platform does

2. CONFIGURE
   → Clicks "Start Mock Interview"
   → Selects role (e.g., Backend Developer)
   → Selects experience level (e.g., Junior 1-2 years)
   → Optionally adjusts: difficulty, duration, focus areas
   → Reviews configuration summary

3. PREPARE
   → Enters interview lobby
   → Sees AI interviewer avatar/visual
   → Reads interview instructions and format
   → Sees estimated duration and question count
   → Clicks "Start Interview"

4. INTERVIEW
   → AI interviewer introduces itself and explains the format
   → AI asks first question (easier, warm-up)
   → Candidate types answer and submits
   → AI evaluates answer internally
   → AI decides: follow-up or next topic
   → If follow-up: asks a probing question on the same topic
   → If next: moves to a new skill area with appropriate difficulty
   → Progress indicator updates
   → Repeats for 8–15 questions
   → AI announces interview completion professionally

5. EVALUATE
   → System generates comprehensive report
   → Loading/processing screen while report generates

6. REVIEW
   → Candidate sees overall score and breakdown
   → Sees per-question feedback
   → Sees strengths and weaknesses
   → Sees recommended topics to study
   → Sees interview readiness assessment
   → Can review full Q&A transcript with evaluations
```

### Secondary Journey: Review Past Interview
```
1. User returns to the application
2. Views interview history
3. Selects a past interview
4. Reviews the report and Q&A transcript
5. Identifies areas that still need improvement
```

## C. Functional Requirements

### FR-1: Role Management
- FR-1.1: System displays available interview roles
- FR-1.2: Each role has associated skill areas and question domains
- FR-1.3: Roles are data-driven (stored in database, not hardcoded)

### FR-2: Interview Configuration
- FR-2.1: User selects a role
- FR-2.2: User selects experience level (Fresher / Junior / Mid / Senior)
- FR-2.3: User can optionally select focus areas from the role's skill set
- FR-2.4: User can select interview difficulty (Easy / Medium / Hard / Adaptive)
- FR-2.5: User can select approximate duration (15min / 30min / 45min)
- FR-2.6: System calculates question budget based on duration

### FR-3: Interview Session
- FR-3.1: System creates an interview session with unique ID
- FR-3.2: AI interviewer introduces itself and explains format
- FR-3.3: AI asks one question at a time
- FR-3.4: Questions progress from easier to harder (within adaptive mode)
- FR-3.5: Questions cover multiple skill areas for the selected role
- FR-3.6: AI asks contextual follow-up questions when appropriate
- FR-3.7: AI does not repeat questions or topics already covered
- FR-3.8: System tracks interview state (current question, progress, skills covered)
- FR-3.9: Candidate submits text answers
- FR-3.10: Each answer is evaluated immediately (internally)
- FR-3.11: Interview completes after question budget is exhausted or all areas covered
- FR-3.12: AI closes the interview professionally
- FR-3.13: All questions and answers are persisted

### FR-4: Answer Evaluation
- FR-4.1: Each answer is evaluated against a defined rubric
- FR-4.2: Evaluation produces structured scores (technical correctness, depth, communication, etc.)
- FR-4.3: Evaluation identifies strengths and weaknesses per answer
- FR-4.4: Evaluation determines if a follow-up question is warranted
- FR-4.5: Evaluation output is validated against a schema (not raw LLM text)

### FR-5: Interview Report
- FR-5.1: System generates a comprehensive report after interview completion
- FR-5.2: Report includes overall score (0–100 scale)
- FR-5.3: Report includes category scores (technical, communication, problem-solving)
- FR-5.4: Report includes per-question breakdown with feedback
- FR-5.5: Report lists strengths (what the candidate did well)
- FR-5.6: Report lists weaknesses (where improvement is needed)
- FR-5.7: Report recommends specific topics to study
- FR-5.8: Report provides interview readiness assessment
- FR-5.9: Report is persisted and can be retrieved later

### FR-6: Interview History
- FR-6.1: User can view list of past interviews (by session identifier)
- FR-6.2: User can view full report for any past interview
- FR-6.3: User can view Q&A transcript for any past interview

## D. Non-Functional Requirements

### Performance
- NFR-1: Landing page loads in < 2 seconds
- NFR-2: Question generation completes in < 5 seconds
- NFR-3: Answer evaluation completes in < 8 seconds
- NFR-4: Report generation completes in < 15 seconds
- NFR-5: API responses (non-AI) return in < 500ms

### Security
- NFR-6: No API keys or secrets in frontend code
- NFR-7: All secrets via environment variables
- NFR-8: Input validation on all API endpoints
- NFR-9: CORS properly configured
- NFR-10: SQL injection prevention via ORM
- NFR-11: No unnecessary PII storage

### Reliability
- NFR-12: Graceful handling of LLM API failures (retry with backoff)
- NFR-13: Interview state persisted to database (survives server restart)
- NFR-14: Validation of all LLM outputs against schemas

### Observability
- NFR-15: Structured logging for all interview lifecycle events
- NFR-16: LLM call logging (latency, token usage, errors — not candidate answers in logs)
- NFR-17: Error tracking with sufficient context for debugging

### Maintainability
- NFR-18: Clean separation of concerns (API / service / repository / AI layers)
- NFR-19: LLM provider abstraction (swappable providers)
- NFR-20: Prompts managed as versioned templates, not inline strings
- NFR-21: Database migrations for all schema changes
- NFR-22: Type safety (TypeScript frontend, Python type hints backend)
- NFR-23: Test coverage for interview engine and evaluation logic
