# Frontend Architecture — InterviewPrepApp

## J. Frontend Architecture

### Technology Choices

**React + Vite (not Next.js)**

Next.js would be the better choice if we needed:
- SEO for public-facing content pages (our pages are behind user interaction)
- Server-side rendering for performance (our SPA loads fast — it's an application, not a content site)
- API routes co-located with frontend (we have a separate Python backend)
- Edge functions (not needed for POC)

Vite + React is the better choice for this POC because:
- Simpler setup and faster dev server
- No SSR complexity for an application that doesn't benefit from it
- Clear separation between frontend and backend
- Lighter deployment (static files)
- Faster build times

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Value proposition, CTA to start interview |
| Role Selection | `/interview/setup` | Select role, experience, configure interview |
| Interview Lobby | `/interview/:id/lobby` | Pre-interview briefing, avatar, start button |
| Interview | `/interview/:id` | Live interview with AI |
| Interview Complete | `/interview/:id/complete` | Completion confirmation, link to report |
| Report | `/interview/:id/report` | Full interview report |
| History | `/history` | List of past interviews |

### Component Architecture

```
src/
├── components/
│   ├── ui/                    — Reusable UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── ScoreDisplay.tsx
│   │   ├── Badge.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── Modal.tsx
│   ├── layout/                — Page structure
│   │   ├── AppLayout.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── interview/             — Interview-specific components
│   │   ├── InterviewerAvatar.tsx   — AI interviewer visual
│   │   ├── QuestionDisplay.tsx     — Shows current question
│   │   ├── AnswerInput.tsx         — Text area for candidate answers
│   │   ├── InterviewProgress.tsx   — Progress indicator
│   │   ├── ConversationHistory.tsx — Q&A history sidebar
│   │   ├── InterviewTimer.tsx      — Elapsed time display
│   │   └── InterviewControls.tsx   — Submit, end interview, etc.
│   ├── report/                — Report display components
│   │   ├── ScoreOverview.tsx       — Overall + category scores
│   │   ├── ScoreBreakdown.tsx      — Detailed per-category breakdown
│   │   ├── StrengthsWeaknesses.tsx — Strengths & weaknesses lists
│   │   ├── QuestionReview.tsx      — Per-question feedback
│   │   ├── Recommendations.tsx     — Study recommendations
│   │   └── ReadinessIndicator.tsx  — Ready / not ready assessment
│   └── setup/                 — Interview setup components
│       ├── RoleCard.tsx
│       ├── ExperienceSelector.tsx
│       ├── DifficultySelector.tsx
│       ├── FocusAreaSelector.tsx
│       └── ConfigSummary.tsx
├── pages/                     — Route-level components
│   ├── LandingPage.tsx
│   ├── InterviewSetupPage.tsx
│   ├── InterviewLobbyPage.tsx
│   ├── InterviewPage.tsx
│   ├── InterviewCompletePage.tsx
│   ├── ReportPage.tsx
│   └── HistoryPage.tsx
├── hooks/                     — Custom hooks
│   ├── useInterview.ts         — Interview session state + actions
│   ├── useInterviewTimer.ts    — Timer logic
│   └── useSessionId.ts         — Browser session management
├── services/                  — API client layer
│   └── api.ts                  — Typed API client (fetch wrapper)
├── types/                     — TypeScript types
│   ├── interview.ts            — Interview, Question, Answer, etc.
│   ├── report.ts               — Report, Evaluation, Scores
│   └── role.ts                 — Role, Skill
├── lib/                       — Utilities
│   └── utils.ts
├── App.tsx                    — Router + providers
└── main.tsx                   — Entry point
```

### State Management

**No global state library needed.** The POC has simple state:

1. **Server state** (interviews, roles, reports) → **TanStack Query**
   - Caching, refetching, loading/error states handled automatically
   - Queries: `useQuery` for GET requests
   - Mutations: `useMutation` for POST requests

2. **Interview session state** → **`useInterview` custom hook** (local state + TanStack mutations)
   - Current question
   - Answer text (controlled input)
   - Interview progress
   - Conversation history (for display)
   - Loading states (waiting for AI)

3. **User session** → **localStorage**
   - `session_user_id` (UUID, auto-generated on first visit)

No Redux, Zustand, or Jotai needed. Adding one later is straightforward if state complexity grows.

### API Integration

```typescript
// services/api.ts — typed fetch wrapper
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// All functions return typed responses, throw on HTTP errors
async function createInterview(config: InterviewConfig): Promise<InterviewSession> { ... }
async function startInterview(id: string): Promise<InterviewStartResponse> { ... }
async function submitAnswer(id: string, answer: AnswerSubmission): Promise<AnswerResponse> { ... }
async function getReport(id: string): Promise<InterviewReport> { ... }
async function getRoles(): Promise<Role[]> { ... }
async function getUserInterviews(userId: string): Promise<InterviewSummary[]> { ... }
```

### Key UI Design Decisions

1. **Interviewer Avatar**: For POC, a clean SVG/CSS avatar with subtle animation (e.g., pulsing when "thinking"). Abstracted behind `InterviewerAvatar` component so it can be replaced with a video avatar (HeyGen, Tavus, etc.) later by swapping the component implementation.

2. **Answer Input**: Large text area with character count. Submit button with loading state while AI evaluates. No live evaluation — candidates should think and submit complete answers.

3. **Progress**: Horizontal progress bar showing question X of Y + skill coverage indicators. Candidates should always know where they are in the interview.

4. **Conversation History**: Collapsible sidebar showing past Q&As in the current session. Helps candidates reference what they've already discussed (like a real interview where you remember prior context).

5. **Report Visualization**: Score bars with color coding (red < 40, yellow 40-70, green > 70). Per-question accordion with expandable feedback. Clean typography for readability.

6. **Responsive**: Desktop-first (interviews are a desktop activity) but responsive down to tablet. Mobile-responsive landing and report pages.

### Styling: Tailwind CSS

Tailwind is chosen over CSS Modules or styled-components because:
- Fastest development speed for a POC
- Consistent design tokens (spacing, colors, typography)
- No CSS file management overhead
- Easy to maintain for a small team
- Built-in responsive utilities

A minimal custom theme will define brand colors and typography in `tailwind.config.ts`.
