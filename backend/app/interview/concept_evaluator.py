"""Concept-based answer evaluator — scores answers using keyword matching against the question bank."""

import re
from collections import Counter

from app.ai.schemas import EvaluationOutput


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", text.lower())


def _concept_coverage(answer_tokens: set[str], concepts: list[str]) -> float:
    if not concepts:
        return 0.5
    hits = 0
    for concept in concepts:
        concept_words = set(_tokenize(concept))
        if concept_words & answer_tokens:
            hits += 1
    return hits / len(concepts)


def _word_overlap(answer_tokens: set[str], reference_tokens: set[str]) -> float:
    if not reference_tokens:
        return 0.5
    intersection = answer_tokens & reference_tokens
    union = answer_tokens | reference_tokens
    if not union:
        return 0.0
    return len(intersection) / len(union)


def _length_score(answer_text: str) -> float:
    words = len(answer_text.split())
    if words < 5:
        return 0.2
    if words < 15:
        return 0.4
    if words < 30:
        return 0.6
    if words < 60:
        return 0.8
    return 1.0


def evaluate_with_concepts(
    answer_text: str,
    expected_concepts: list[str],
    reference_answer: str,
    difficulty: str = "medium",
) -> EvaluationOutput:
    answer_tokens = set(_tokenize(answer_text))
    ref_tokens = set(_tokenize(reference_answer))

    coverage = _concept_coverage(answer_tokens, expected_concepts)
    overlap = _word_overlap(answer_tokens, ref_tokens)
    length = _length_score(answer_text)

    difficulty_multiplier = {"easy": 1.1, "medium": 1.0, "hard": 0.9}.get(difficulty, 1.0)

    base_score = (coverage * 0.5 + overlap * 0.3 + length * 0.2) * 10 * difficulty_multiplier
    base_score = max(0.0, min(10.0, round(base_score, 1)))

    technical = min(10.0, round(coverage * 10 * difficulty_multiplier, 1))
    depth = min(10.0, round(overlap * 10 * difficulty_multiplier, 1))
    clarity = min(10.0, round(length * 10, 1))
    relevance = min(10.0, round((coverage * 0.6 + overlap * 0.4) * 10, 1))
    problem_solving = min(10.0, round((overlap * 0.5 + length * 0.5) * 10 * difficulty_multiplier, 1))
    completeness_val = min(10.0, round(coverage * 10, 1))

    matched = [c for c in expected_concepts if set(_tokenize(c)) & answer_tokens]
    missed = [c for c in expected_concepts if c not in matched]

    strengths = []
    weaknesses = []

    if coverage >= 0.7:
        strengths.append(f"Covered most key concepts: {', '.join(matched[:3])}")
    elif coverage >= 0.4:
        strengths.append(f"Mentioned some relevant concepts: {', '.join(matched[:2])}")

    if overlap >= 0.3:
        strengths.append("Answer aligns well with expected knowledge")
    if length >= 0.6:
        strengths.append("Provided a detailed response")

    if not strengths:
        strengths.append("Attempted to answer the question")

    if missed:
        weaknesses.append(f"Missing key concepts: {', '.join(missed[:3])}")
    if length < 0.4:
        weaknesses.append("Answer could be more detailed")
    if coverage < 0.3:
        weaknesses.append("Answer does not address core concepts of the question")

    if not weaknesses:
        weaknesses.append("Could provide more real-world examples")

    if base_score >= 7:
        feedback = "Good understanding demonstrated. Consider adding more specific examples and edge cases."
    elif base_score >= 5:
        feedback = f"Partial understanding shown. Review these concepts: {', '.join(missed[:2])}." if missed else "Decent attempt, but more depth is needed."
    elif base_score >= 3:
        feedback = f"Some gaps in understanding. Key areas to study: {', '.join(missed[:3])}." if missed else "The answer needs more technical depth."
    else:
        feedback = "The answer does not demonstrate sufficient understanding. Review the fundamentals of this topic."

    follow_up = coverage < 0.5 and len(answer_text.split()) > 10

    return EvaluationOutput(
        technical_correctness=technical,
        conceptual_depth=depth,
        communication_clarity=clarity,
        relevance=relevance,
        problem_solving=problem_solving,
        completeness=completeness_val,
        overall_score=base_score,
        strengths=strengths,
        weaknesses=weaknesses,
        feedback=feedback,
        follow_up_recommended=follow_up,
        follow_up_reason="Candidate showed partial understanding; a follow-up could help clarify" if follow_up else None,
    )
