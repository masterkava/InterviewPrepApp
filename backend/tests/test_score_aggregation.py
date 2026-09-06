"""Unit tests for deterministic score aggregation."""

import uuid
from unittest.mock import MagicMock

import pytest

from app.interview.report_generator import ScoreAggregation, aggregate_scores


def _mock_evaluation(
    tc: float = 7.0, cd: float = 7.0, cc: float = 7.0,
    rel: float = 7.0, ps: float = 7.0, comp: float = 7.0,
    overall: float = 7.0,
) -> MagicMock:
    ev = MagicMock()
    ev.technical_correctness = tc
    ev.conceptual_depth = cd
    ev.communication_clarity = cc
    ev.relevance = rel
    ev.problem_solving = ps
    ev.completeness = comp
    ev.overall_score = overall
    return ev


def test_empty_evaluations():
    result = aggregate_scores([])
    assert result.overall_score == 0
    assert result.readiness_level == "not_ready"
    assert result.category_breakdown == {}


def test_single_uniform_evaluation():
    ev = _mock_evaluation(tc=7, cd=7, cc=7, rel=7, ps=7, comp=7, overall=7)
    result = aggregate_scores([ev])

    # technical = (7*0.40 + 7*0.35 + 7*0.25) * 10 = 7 * 10 = 70
    assert result.technical_score == 70.0
    # communication = 7 * 10 = 70
    assert result.communication_score == 70.0
    # problem_solving = (7*0.60 + 7*0.40) * 10 = 70
    assert result.problem_solving_score == 70.0
    # overall = 70*0.45 + 70*0.25 + 70*0.30 = 70
    assert result.overall_score == 70.0
    # single evaluation -> confidence = 50
    assert result.confidence_score == 50.0
    assert result.readiness_level == "almost_ready"


def test_weighted_technical_score():
    ev = _mock_evaluation(tc=8, cd=6, cc=5, rel=5, ps=5, comp=4)
    result = aggregate_scores([ev])
    # technical = (8*0.40 + 6*0.35 + 4*0.25) * 10 = (3.2 + 2.1 + 1.0) * 10 = 63
    assert result.technical_score == 63.0


def test_weighted_problem_solving_score():
    ev = _mock_evaluation(ps=9, rel=5)
    result = aggregate_scores([ev])
    # problem_solving = (9*0.60 + 5*0.40) * 10 = (5.4 + 2.0) * 10 = 74
    assert result.problem_solving_score == 74.0


def test_overall_formula():
    ev = _mock_evaluation(tc=10, cd=10, cc=10, rel=10, ps=10, comp=10)
    result = aggregate_scores([ev])
    # All 10s -> tech=100, comm=100, ps=100
    # overall = 100*0.45 + 100*0.25 + 100*0.30 = 100
    assert result.overall_score == 100.0
    assert result.readiness_level == "strong"


def test_confidence_high_consistency():
    evs = [_mock_evaluation(overall=7) for _ in range(5)]
    result = aggregate_scores(evs)
    # std_dev = 0, confidence = 100
    assert result.confidence_score == 100.0


def test_confidence_low_consistency():
    evs = [
        _mock_evaluation(overall=2),
        _mock_evaluation(overall=9),
    ]
    result = aggregate_scores(evs)
    # mean = 5.5, variance = ((2-5.5)^2 + (9-5.5)^2)/2 = (12.25+12.25)/2 = 12.25
    # std_dev = 3.5, confidence = 100 - 35 = 65
    assert result.confidence_score == 65.0


def test_confidence_clamped_at_zero():
    evs = [
        _mock_evaluation(overall=0),
        _mock_evaluation(overall=10),
    ]
    result = aggregate_scores(evs)
    # mean=5, var=25, std=5, conf=100-50=50
    assert result.confidence_score == 50.0

    evs2 = [
        _mock_evaluation(overall=0),
        _mock_evaluation(overall=10),
        _mock_evaluation(overall=0),
        _mock_evaluation(overall=10),
    ]
    result2 = aggregate_scores(evs2)
    # mean=5, var=25, std=5, conf=50
    assert result2.confidence_score == 50.0


def test_readiness_levels():
    for score, expected in [
        (0, "not_ready"), (15, "not_ready"), (30, "not_ready"),
        (31, "needs_work"), (50, "needs_work"),
        (51, "almost_ready"), (70, "almost_ready"),
        (71, "ready"), (85, "ready"),
        (86, "strong"), (100, "strong"),
    ]:
        ev = _mock_evaluation(
            tc=score/10, cd=score/10, cc=score/10,
            rel=score/10, ps=score/10, comp=score/10,
        )
        result = aggregate_scores([ev])
        assert result.readiness_level == expected, f"score={score} expected {expected} got {result.readiness_level}"


def test_category_breakdown_present():
    ev = _mock_evaluation(tc=8, cd=6, cc=7, rel=5, ps=9, comp=4)
    result = aggregate_scores([ev])
    assert "technical_correctness" in result.category_breakdown
    assert result.category_breakdown["technical_correctness"] == 80.0
    assert result.category_breakdown["conceptual_depth"] == 60.0
    assert result.category_breakdown["communication_clarity"] == 70.0
    assert result.category_breakdown["problem_solving"] == 90.0
    assert result.category_breakdown["completeness"] == 40.0
    assert result.category_breakdown["relevance"] == 50.0


def test_multiple_evaluations_averaged():
    ev1 = _mock_evaluation(tc=8, cd=8, cc=8, rel=8, ps=8, comp=8)
    ev2 = _mock_evaluation(tc=6, cd=6, cc=6, rel=6, ps=6, comp=6)
    result = aggregate_scores([ev1, ev2])
    # averages are all 7 -> same as uniform 7 test
    assert result.technical_score == 70.0
    assert result.communication_score == 70.0
    assert result.problem_solving_score == 70.0
    assert result.overall_score == 70.0
