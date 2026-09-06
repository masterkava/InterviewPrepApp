# Risk Assessment — InterviewPrepApp

## N. Technical & Product Risks

---

### Risk 1: LLM Hallucination / Incorrect Evaluation
**Severity:** High  
**Probability:** Medium  

**Description:** The LLM may evaluate a correct answer as wrong, give inflated scores to vague answers, or generate technically inaccurate questions.

**Impact:** Candidate loses trust in the platform. Unfair scores undermine the core value proposition.

**Mitigation:**
- **Detailed rubric in every evaluation prompt** — the LLM is not asked to "rate this answer," it's given explicit criteria per score level (see scoring methodology doc).
- **Structured output validation** — every LLM response is validated against a Pydantic schema. Invalid responses are retried.
- **Quantitative scores are computed deterministically** — category and overall scores are weighted averages of per-answer scores, not LLM-generated numbers. The LLM only scores individual dimensions (0-10) with rubric guidance.
- **Raw LLM responses stored** — enables retroactive quality analysis and prompt improvement.
- **Prompt versioning** — when we improve prompts, we can compare evaluation quality across versions.
- **Future:** Human evaluation samples to calibrate LLM scoring against expert assessments.

---

### Risk 2: Inconsistent Evaluation Across Sessions
**Severity:** High  
**Probability:** Medium  

**Description:** The same answer might get a 6/10 in one session and an 8/10 in another, due to LLM non-determinism.

**Impact:** Candidates can't track real progress. Scores become meaningless.

**Mitigation:**
- **Temperature = 0** (or near-zero) for evaluation calls. This reduces randomness in scoring.
- **Explicit rubric with score-level descriptions** — anchoring the LLM's scoring to specific criteria reduces variance.
- **Experience-level calibration** — the prompt explicitly states what is expected at each level, preventing drift.
- **Monitoring:** Store all evaluations with prompt versions. Periodically run the same answer through evaluation and measure score variance. If variance > 1 point on any dimension, refine the rubric.

---

### Risk 3: Poor Interview Realism
**Severity:** High  
**Probability:** Low-Medium  

**Description:** The interview might feel like a chatbot quiz rather than a real interview. Questions might be generic, transitions awkward, or the AI might not "listen" to answers.

**Impact:** Fails the core product hypothesis — the experience should feel like "an AI interviewer is actually interviewing me."

**Mitigation:**
- **Rich interview context** — the question generation prompt includes the full recent conversation (last 3 Q&As), so the AI maintains conversational continuity.
- **Follow-up questions** — the system explicitly decides when to probe deeper, creating a natural interview rhythm (not just question → question → question).
- **Interviewer persona** — the system prompt establishes a specific interviewer personality (professional, encouraging, thorough) rather than a generic AI assistant.
- **Progressive difficulty** — starting easy and building harder creates a natural interview arc.
- **Professional introduction and closing** — the interview has a beginning, middle, and end.
- **User testing:** Before Phase 8, conduct at least 3 end-to-end interviews and evaluate realism subjectively. Iterate on prompts based on findings.

---

### Risk 4: Latency / Slow AI Responses
**Severity:** Medium  
**Probability:** Medium  

**Description:** LLM API calls take 2-8 seconds each. Each "answer" request involves evaluation (LLM call) + next question generation (LLM call) = potentially 4-16 seconds.

**Impact:** Candidate sits waiting, breaking the interview flow. UX feels sluggish.

**Mitigation:**
- **Two-tier model strategy** — use gpt-4o-mini (faster, cheaper) for question generation, gpt-4o for evaluation. Generation is less latency-sensitive than you'd think — in a real interview, there's a natural pause between your answer and the next question.
- **Good loading UX** — show a "thinking" state on the interviewer avatar, with a message like "Evaluating your answer..." This mirrors a real interviewer taking a moment to think.
- **Parallel where possible** — evaluate the current answer and generate the next question in parallel (not sequentially) when the next question doesn't depend on the evaluation result. However, follow-up decisions DO depend on evaluation, so this optimization only applies to "new topic" transitions.
- **Response streaming (future)** — stream the next question text as it's generated. Not needed for POC.
- **Timeout handling** — if an LLM call takes > 30 seconds, timeout and retry once. If retry fails, use a fallback (seed question for generation, "evaluation_pending" for evaluation).

---

### Risk 5: STT (Speech-to-Text) Accuracy
**Severity:** Medium  
**Probability:** Medium (if implemented)  

**Description:** Browser Web Speech API has variable quality across browsers and environments. Technical jargon (API names, library names, algorithms) may be misrecognized.

**Impact:** AI evaluates a garbled transcript of what the candidate actually said, leading to unfair scores.

**Mitigation:**
- **Text-first for POC** — voice input is Phase 7, optional. The core product works with typed answers.
- **Show transcription to candidate** — let them see what the STT heard and correct it before submitting.
- **Fallback to typing** — voice is always optional, with a visible toggle.
- **Future:** Use a cloud STT provider (Deepgram, AssemblyAI) with technical vocabulary models instead of browser APIs.

---

### Risk 6: AI API Cost
**Severity:** Medium  
**Probability:** Low  

**Description:** Each interview involves ~10 questions × (1 evaluation call + 1 generation call) + 1 report call ≈ 21 LLM API calls. At scale, this could be expensive.

**Estimated cost per interview (current pricing):
- Question generation (gpt-4o-mini): ~$0.01-0.03 per call × 10 = $0.10-0.30
- Answer evaluation (gpt-4o): ~$0.03-0.10 per call × 10 = $0.30-1.00
- Report generation (gpt-4o): ~$0.10-0.20 × 1 = $0.10-0.20
- **Total: ~$0.50-1.50 per interview**

**Impact:** At 1000 interviews/day, cost would be $500-1500/day. Manageable for a funded product, but needs monitoring.

**Mitigation:**
- **Two-tier model strategy** already reduces cost (gpt-4o-mini for generation).
- **Token budget awareness** — prompts are designed to be concise. Context window management prevents sending unnecessary history.
- **Usage logging** — every LLM call logs token count and cost. We can track cost per interview and optimize.
- **Future:** Evaluate open-source models (Llama 3, Mixtral) for question generation to reduce costs. Provider abstraction makes this a configuration change.
- **Future:** Implement prompt caching (Anthropic) or batch API (OpenAI) for cost reduction.

---

### Risk 7: Question Quality & Repetition
**Severity:** Medium  
**Probability:** Low-Medium  

**Description:** LLM-generated questions might be too generic, too similar across sessions, or inappropriate for the experience level.

**Impact:** Candidates who take multiple interviews see the same questions. Interview doesn't test the right skills.

**Mitigation:**
- **Skill-weighted question distribution** — the engine tracks which skills have been covered and steers generation toward uncovered areas.
- **Questions-asked context** — the generation prompt includes all previously asked questions (text) to prevent repetition within a session.
- **Experience-level calibration** — the prompt explicitly states the candidate's level and what types of questions are appropriate.
- **Seed questions for warm-up** — the first question comes from a curated bank, ensuring a good start.
- **Future:** Build a question deduplication index across sessions for the same user, so returning users get fresh questions.

---

### Risk 8: Candidate Cheating (Using AI to Answer)
**Severity:** Low (for POC)  
**Probability:** High  

**Description:** Candidates can paste questions into ChatGPT and submit AI-generated answers.

**Impact:** For a practice platform, this primarily hurts the candidate (they're cheating themselves). For any future certification or assessment use, it's a serious problem.

**Mitigation for POC:**
- **Not a priority.** The POC is a practice tool — cheating only hurts the user's own preparation. We don't claim assessment validity for hiring.
- **Response time tracking** — we record how long the candidate takes per answer. Suspiciously fast answers with high quality could be flagged.
- **Future mitigations (not for POC):**
  - AI-generated answer detection
  - Proctoring (webcam monitoring)
  - Copy-paste detection
  - Time-pressure constraints
  - Voice-only mode (harder to cheat)
  - Follow-up questions that probe understanding (already in the system)

---

### Risk 9: Scoring Fairness
**Severity:** High  
**Probability:** Low  

**Description:** The scoring system might systematically favor certain communication styles, penalize non-native English speakers, or reward verbose answers over concise correct ones.

**Impact:** Unfair scores undermine trust and could be discriminatory.

**Mitigation:**
- **Rubric focuses on technical content first** — technical correctness has the highest weight (40% of technical score). Communication is 25% of overall.
- **Completeness ≠ verbosity** — the rubric explicitly defines completeness as "covering expected points," not word count.
- **Experience-level calibration** — a correct but simple answer from a fresher scores well; the same answer from a senior is expected to have more depth.
- **Future:** Test the system with answers of varying styles (concise vs. verbose, formal vs. casual) to the same question and verify scores are fair.
- **Future:** Bias testing with answers from diverse linguistic backgrounds.

---

### Risk 10: Browser Compatibility / Frontend Issues
**Severity:** Low  
**Probability:** Low  

**Description:** The application might not work consistently across browsers, especially if we use newer web APIs.

**Impact:** Users can't complete interviews.

**Mitigation:**
- **Standard React + Tailwind** — no cutting-edge browser APIs needed for the core text-based experience.
- **Speech APIs (Phase 7)** — browser speech recognition is Chrome-first. We document browser requirements and make it optional.
- **Responsive design** — test on Chrome, Firefox, Safari, and Edge.
- **Error boundaries** — React error boundaries prevent full-page crashes.

---

### Risk Summary Matrix

| Risk | Severity | Probability | Mitigation Status |
|------|----------|-------------|-------------------|
| LLM Hallucination | High | Medium | Rubric + validation + deterministic aggregation |
| Inconsistent Evaluation | High | Medium | Low temperature + rubric anchoring + monitoring |
| Poor Interview Realism | High | Low-Medium | Context management + follow-ups + persona |
| Latency | Medium | Medium | Two-tier models + loading UX + parallel calls |
| STT Accuracy | Medium | Medium | Text-first, STT optional |
| AI API Cost | Medium | Low | Two-tier models + usage logging |
| Question Quality | Medium | Low-Medium | Skill weighting + dedup + calibration |
| Candidate Cheating | Low (POC) | High | Not a POC priority |
| Scoring Fairness | High | Low | Rubric design + future bias testing |
| Browser Compatibility | Low | Low | Standard tech stack |
