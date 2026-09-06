# API Contract — InterviewPrepApp

## G. API Design

### Base URL
```
/api/v1
```

### Conventions
- All request/response bodies are JSON
- UUIDs for all resource identifiers
- ISO 8601 timestamps
- HTTP status codes used correctly (200, 201, 400, 404, 422, 500)
- Error responses follow a consistent schema

### Error Response Schema
```json
{
  "error": {
    "code": "INTERVIEW_NOT_FOUND",
    "message": "Interview session with ID xyz not found",
    "details": {}
  }
}
```

---

## Endpoints

### 1. Roles & Configuration

#### `GET /api/v1/roles`
List available interview roles.

**Response 200:**
```json
{
  "roles": [
    {
      "id": "uuid",
      "slug": "backend-developer",
      "name": "Backend Developer",
      "description": "Python, APIs, databases, system design basics...",
      "skills": [
        {
          "id": "uuid",
          "slug": "python",
          "name": "Python",
          "category": "language",
          "weight": 9
        }
      ]
    }
  ]
}
```

#### `GET /api/v1/roles/{role_id}/skills`
List skills for a specific role with weights.

**Response 200:**
```json
{
  "role_id": "uuid",
  "role_name": "Backend Developer",
  "skills": [
    {
      "id": "uuid",
      "slug": "python",
      "name": "Python",
      "category": "language",
      "weight": 9
    }
  ]
}
```

---

### 2. Interview Session Lifecycle

#### `POST /api/v1/interviews`
Create a new interview session with configuration.

**Request:**
```json
{
  "user_id": "uuid (optional — auto-created if absent)",
  "role_id": "uuid",
  "experience_level": "junior",
  "difficulty": "adaptive",
  "duration_minutes": 30,
  "focus_areas": ["python", "databases", "apis"]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "role": {
    "id": "uuid",
    "name": "Backend Developer"
  },
  "experience_level": "junior",
  "difficulty": "adaptive",
  "duration_minutes": 30,
  "question_budget": 10,
  "focus_areas": ["python", "databases", "apis"],
  "status": "configured",
  "created_at": "2026-09-05T10:00:00Z"
}
```

**Errors:**
- 400: Invalid role_id, invalid experience_level, invalid difficulty
- 422: Validation error (missing required fields)

#### `GET /api/v1/interviews/{id}`
Get interview session details and current state.

**Response 200:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "role": {
    "id": "uuid",
    "name": "Backend Developer"
  },
  "experience_level": "junior",
  "difficulty": "adaptive",
  "duration_minutes": 30,
  "question_budget": 10,
  "questions_asked": 5,
  "status": "in_progress",
  "focus_areas": ["python", "databases", "apis"],
  "started_at": "2026-09-05T10:01:00Z",
  "completed_at": null,
  "created_at": "2026-09-05T10:00:00Z"
}
```

**Errors:**
- 404: Interview not found

#### `POST /api/v1/interviews/{id}/start`
Start the interview. AI interviewer introduces itself and asks the first question.

**Request:** (empty body)

**Response 200:**
```json
{
  "session_id": "uuid",
  "status": "in_progress",
  "interviewer_message": "Hello! I'm your AI interviewer today. I'll be conducting a Backend Developer interview tailored to your junior-level experience. We'll cover Python, databases, and APIs over approximately 10 questions. I'll start with some foundational questions and adjust based on your responses. Let's begin!",
  "question": {
    "id": "uuid",
    "sequence_number": 1,
    "question_text": "Can you explain what a RESTful API is and what makes an API 'RESTful'?",
    "difficulty": "easy",
    "skill": "apis",
    "question_type": "initial"
  },
  "progress": {
    "current": 1,
    "total": 10,
    "skills_covered": ["apis"],
    "skills_remaining": ["python", "databases"]
  }
}
```

**Errors:**
- 404: Interview not found
- 409: Interview already started or completed

#### `POST /api/v1/interviews/{id}/answer`
Submit an answer to the current question. Returns evaluation and the next question.

**Request:**
```json
{
  "question_id": "uuid",
  "answer_text": "A RESTful API is an API that follows REST principles. REST stands for Representational State Transfer. It uses standard HTTP methods like GET, POST, PUT, DELETE. RESTful APIs are stateless, meaning each request contains all the information needed to process it. Resources are identified by URLs, and data is typically exchanged in JSON format.",
  "response_time_seconds": 45
}
```

**Response 200:**
```json
{
  "evaluation": {
    "question_id": "uuid",
    "overall_score": 7,
    "technical_correctness": 8,
    "conceptual_depth": 6,
    "communication_clarity": 8,
    "relevance": 9,
    "completeness": 6,
    "feedback": "Good understanding of the basics. You correctly identified HTTP methods, statelessness, and JSON. To strengthen your answer, you could mention HATEOAS, uniform interface constraints, or the difference between REST and RESTful.",
    "strengths": ["Correctly identified core REST principles", "Clear and structured explanation"],
    "weaknesses": ["Missing mention of REST constraints like HATEOAS", "Could discuss resource representations in more depth"]
  },
  "next_question": {
    "id": "uuid",
    "sequence_number": 2,
    "question_text": "You mentioned that REST APIs are stateless. Can you explain what that means in practice and why statelessness is important for scalability?",
    "difficulty": "medium",
    "skill": "apis",
    "question_type": "follow_up",
    "parent_question_id": "uuid"
  },
  "progress": {
    "current": 2,
    "total": 10,
    "skills_covered": ["apis"],
    "skills_remaining": ["python", "databases"]
  },
  "interview_complete": false
}
```

When the interview is complete:
```json
{
  "evaluation": { "..." },
  "next_question": null,
  "progress": {
    "current": 10,
    "total": 10,
    "skills_covered": ["apis", "python", "databases"],
    "skills_remaining": []
  },
  "interview_complete": true,
  "closing_message": "Thank you for completing this interview! You've done well across several areas. I'll now generate your detailed performance report."
}
```

**Errors:**
- 400: Question ID doesn't match current question
- 404: Interview not found
- 409: Interview not in progress, or answer already submitted for this question

#### `POST /api/v1/interviews/{id}/complete`
Force-complete an interview early (candidate wants to end).

**Request:** (empty body)

**Response 200:**
```json
{
  "session_id": "uuid",
  "status": "completed",
  "questions_asked": 6,
  "question_budget": 10,
  "message": "Interview ended early. Your report will be generated based on the questions answered."
}
```

#### `GET /api/v1/interviews/{id}/report`
Get the interview report. If not yet generated, triggers generation.

**Response 200:**
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "overall_score": 72,
  "technical_score": 75,
  "communication_score": 70,
  "problem_solving_score": 68,
  "confidence_score": 65,
  "readiness_level": "almost_ready",
  "summary": "You demonstrated solid foundational knowledge in backend development...",
  "strengths": [
    "Strong understanding of REST API principles",
    "Clear communication style",
    "Good practical knowledge of Python data structures"
  ],
  "weaknesses": [
    "Database indexing and query optimization needs work",
    "Could improve depth on system design topics",
    "Some answers lacked practical examples"
  ],
  "recommendations": [
    "Practice explaining concepts with real-world examples",
    "Study database indexing strategies and query plans",
    "Review caching strategies (Redis, CDN, application-level)"
  ],
  "recommended_topics": [
    "Database indexing and optimization",
    "Caching strategies",
    "System design basics",
    "Python concurrency (asyncio, threading)"
  ],
  "category_breakdown": {
    "technical_correctness": 78,
    "conceptual_depth": 65,
    "communication_clarity": 72,
    "problem_solving": 68,
    "practical_knowledge": 70
  },
  "questions": [
    {
      "sequence_number": 1,
      "question_text": "...",
      "answer_text": "...",
      "evaluation": {
        "overall_score": 7,
        "feedback": "...",
        "strengths": ["..."],
        "weaknesses": ["..."]
      }
    }
  ],
  "created_at": "2026-09-05T10:35:00Z"
}
```

**Errors:**
- 404: Interview not found
- 409: Interview not completed yet

---

### 3. Interview History

#### `GET /api/v1/users/{user_id}/interviews`
List a user's past interviews.

**Query Parameters:**
- `status` (optional): filter by status
- `limit` (optional, default 20): page size
- `offset` (optional, default 0): pagination offset

**Response 200:**
```json
{
  "interviews": [
    {
      "id": "uuid",
      "role_name": "Backend Developer",
      "experience_level": "junior",
      "status": "completed",
      "overall_score": 72,
      "questions_asked": 10,
      "started_at": "2026-09-05T10:01:00Z",
      "completed_at": "2026-09-05T10:35:00Z"
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

---

### 4. Health Check

#### `GET /api/v1/health`
**Response 200:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "database": "connected"
}
```
