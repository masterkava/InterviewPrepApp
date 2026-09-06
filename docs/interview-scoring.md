# Interview Scoring Methodology — InterviewPrepApp

## I. Scoring Rubric Design

### Principles

1. **Transparent**: Every score can be traced back to specific criteria. No "AI magic numbers."
2. **Deterministic aggregation**: Category and overall scores are computed via weighted averages of per-answer scores — not by asking the LLM for an overall number.
3. **Calibrated by experience level**: A "7/10 for a junior" is different from a "7/10 for a senior." The LLM prompt includes calibration instructions.
4. **Consistent**: The same answer to the same question should produce similar scores across sessions. This is achieved through a detailed rubric, not just "rate 0-10."

### Per-Answer Scoring Dimensions (0-10)

#### 1. Technical Correctness
How factually and technically accurate is the answer?

| Score | Criteria |
|-------|----------|
| 0-1 | No relevant content or completely wrong |
| 2-3 | Major factual errors, fundamental misunderstanding |
| 4-5 | Partially correct; key concept understood but significant errors present |
| 6-7 | Mostly correct; minor inaccuracies that don't undermine understanding |
| 8-9 | Accurate and precise; demonstrates solid technical knowledge |
| 10 | Flawless; textbook-quality accuracy with nuanced correctness |

#### 2. Conceptual Depth
Does the candidate understand *why*, not just *what*?

| Score | Criteria |
|-------|----------|
| 0-1 | No understanding demonstrated |
| 2-3 | Rote/memorized answer without understanding |
| 4-5 | Basic understanding; explains the "what" but not the "why" |
| 6-7 | Good understanding; explains reasoning and some trade-offs |
| 8-9 | Deep understanding; discusses edge cases, alternatives, trade-offs |
| 10 | Expert-level; connects to broader principles, explains when NOT to use something |

#### 3. Communication Clarity
Can the candidate explain their thinking clearly?

| Score | Criteria |
|-------|----------|
| 0-1 | Incoherent or incomprehensible |
| 2-3 | Very unclear; ideas are present but poorly expressed |
| 4-5 | Understandable but disorganized or verbose |
| 6-7 | Clear and reasonably well-structured |
| 8-9 | Well-structured; logical flow, appropriate detail level |
| 10 | Exceptionally articulate; would impress any interviewer |

#### 4. Relevance
Does the answer address the question that was asked?

| Score | Criteria |
|-------|----------|
| 0-1 | Completely off-topic |
| 2-3 | Tangentially related at best |
| 4-5 | Addresses the question but includes significant irrelevant content |
| 6-7 | Directly addresses the question with minor tangents |
| 8-9 | Precisely targeted; every part contributes to answering the question |
| 10 | Perfect focus with excellent scope judgment |

#### 5. Problem Solving
Does the candidate demonstrate analytical thinking?

| Score | Criteria |
|-------|----------|
| 0-1 | No analytical approach |
| 2-3 | Jumps to conclusions without reasoning |
| 4-5 | Shows some reasoning but misses important considerations |
| 6-7 | Systematic approach; considers multiple angles |
| 8-9 | Strong analytical framework; considers constraints, trade-offs, and alternatives |
| 10 | Exceptional; breaks down complex problems, identifies hidden assumptions |

#### 6. Completeness
Does the answer cover the expected scope for this experience level?

| Score | Criteria |
|-------|----------|
| 0-1 | Barely attempted |
| 2-3 | Covers one aspect, misses most |
| 4-5 | Covers main point but misses important secondary points |
| 6-7 | Covers most expected points for this experience level |
| 8-9 | Comprehensive; covers primary and secondary points |
| 10 | Exhaustive; covers everything expected and adds valuable extras |

### Experience Level Calibration

The rubric is applied relative to what is expected at the candidate's stated experience level:

- **Fresher**: Expected to know fundamentals. Practical experience not expected. A complete, correct explanation of a basic concept scores 8-9.
- **Junior (1-2 yr)**: Expected to know fundamentals well and have some practical experience. Should be able to relate concepts to real usage.
- **Mid (3-5 yr)**: Expected to demonstrate depth, trade-off analysis, and real-world experience. Surface-level answers score lower.
- **Senior (5+ yr)**: Expected to demonstrate mastery, system-level thinking, and mentoring-level clarity. Must discuss edge cases, failures, and alternatives.

This calibration is embedded in the evaluation prompt: "Score this answer as you would evaluate a {experience_level} candidate. A {experience_level} is expected to..."

### Category Score Aggregation (0-100)

Category scores are **computed deterministically** from per-answer dimension scores. No LLM involved.

```
Technical Score (0-100):
  = ( avg(technical_correctness) × 0.40
    + avg(conceptual_depth) × 0.35
    + avg(completeness) × 0.25
    ) × 10

Communication Score (0-100):
  = avg(communication_clarity) × 10

Problem Solving Score (0-100):
  = ( avg(problem_solving) × 0.60
    + avg(relevance) × 0.40
    ) × 10

Overall Score (0-100):
  = technical_score × 0.45
  + communication_score × 0.25
  + problem_solving_score × 0.30

Confidence Score (0-100):
  Based on score consistency across questions.
  = 100 - (standard_deviation_of_overall_scores × 10)
  Clamped to [0, 100].

  Interpretation:
  - High confidence (80+): Candidate performs consistently
  - Medium confidence (50-79): Some variability, inconsistent areas
  - Low confidence (<50): Very inconsistent, performance varies significantly
```

### Readiness Level

| Score Range | Level | Meaning |
|-------------|-------|---------|
| 0-30 | `not_ready` | Significant knowledge gaps. Needs substantial study before interviewing. |
| 31-50 | `needs_work` | Foundation exists but important areas need improvement. Could pass some easy interviews. |
| 51-70 | `almost_ready` | Good base. Address specific weak areas for best results. Likely competitive for junior roles. |
| 71-85 | `ready` | Well-prepared. Should perform competently in interviews at this level. |
| 86-100 | `strong` | Excellent preparation. Expected to perform well and stand out. |

### Follow-up Decision Logic

After evaluation, the system decides whether to ask a follow-up:

```
Ask follow-up if ANY of:
  1. overall_score <= 4 AND the topic is a high-weight skill
     → Purpose: give candidate a chance to recover / clarify
  2. overall_score >= 7 AND conceptual_depth < 7
     → Purpose: candidate seems to know it — probe for depth
  3. The evaluator explicitly flags follow_up_recommended = true
     → Purpose: evaluator identified something worth exploring

Do NOT follow up if:
  - Already asked 2 follow-ups on this topic (prevent rabbit-holing)
  - Question budget is nearly exhausted (< 2 remaining)
  - The skill area has already been sufficiently covered
```

### What the LLM Contributes vs. What is Computed

| Aspect | Source |
|--------|--------|
| Per-answer dimension scores (0-10) | LLM (guided by rubric) |
| Per-answer strengths, weaknesses, feedback | LLM |
| Follow-up recommendation | LLM |
| Category scores (0-100) | **Computed** (weighted average) |
| Overall score (0-100) | **Computed** (weighted average) |
| Confidence score | **Computed** (statistical) |
| Readiness level | **Computed** (threshold mapping) |
| Report strengths / weaknesses / recommendations | LLM (qualitative analysis of full interview) |
| Summary narrative | LLM |

This separation ensures that **scores are reproducible and explainable** while still leveraging the LLM's ability to produce nuanced qualitative feedback.
