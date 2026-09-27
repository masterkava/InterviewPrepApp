# Frontend

React 18 SPA with TypeScript, built with Vite.

## Layout

- `src/App.tsx` — React Router routes
- `src/main.tsx` — entry point
- `src/services/api.ts` — all API calls (fetch-based, relative URLs)
- `src/types/` — TypeScript interfaces matching backend schemas
- `src/pages/` — route pages
- `src/components/` — shared components (AppLayout, InterviewerAvatar)

## Pages

| Page | Route | Purpose |
|------|-------|---------|
| `LandingPage` | `/` | Home page |
| `InterviewSetupPage` | `/interview/setup` | Role selection + mode (text/voice) |
| `InterviewLobbyPage` | `/interview/lobby/:id` | Pre-interview countdown |
| `InterviewPage` | `/interview/:id` | Text-based interview |
| `VoiceInterviewPage` | `/interview/:id/voice` | Voice interview (TTS + STT) |
| `InterviewCompletePage` | `/interview/:id/complete` | Post-interview summary |
| `InterviewReportPage` | `/interview/:id/report` | Scored report with model answers |
| `InterviewHistoryPage` | `/history` | Past interview sessions |
| `QuestionBankPage` | `/question-bank` | Browse all questions |

## Dev Server

```bash
npm run dev    # Vite on :5173
```

Vite proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`).

## Conventions

- No component library — plain HTML/CSS with inline styles
- API calls go through `src/services/api.ts` — all functions return typed responses
- `useSessionId` hook manages anonymous user sessions via localStorage
- Voice recording uses MediaRecorder API with WebM/Opus codec
