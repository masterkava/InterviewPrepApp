import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getReport } from '../services/api';
import type { ReportResponse } from '../types/interview';

const READINESS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  strong: { label: 'Strong', color: 'text-green-800', bg: 'bg-green-100' },
  ready: { label: 'Ready', color: 'text-blue-800', bg: 'bg-blue-100' },
  almost_ready: { label: 'Almost Ready', color: 'text-amber-800', bg: 'bg-amber-100' },
  needs_work: { label: 'Needs Work', color: 'text-orange-800', bg: 'bg-orange-100' },
  not_ready: { label: 'Not Ready', color: 'text-red-800', bg: 'bg-red-100' },
};

export default function InterviewReportPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', interviewId],
    queryFn: () => getReport(interviewId!),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">Generating your report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium">Failed to load report</p>
          <p className="text-red-600 text-sm mt-1">The interview may not be completed yet.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const readiness = READINESS_CONFIG[report.readiness_level] ?? READINESS_CONFIG.needs_work;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Interview Report</h1>
        <p className="mt-2 text-gray-500">{report.summary}</p>
      </div>

      {/* Overall Score Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-8 text-white text-center">
          <div className="text-6xl font-bold">{report.overall_score.toFixed(1)}</div>
          <div className="text-primary-200 text-lg mt-1">Overall Score</div>
          <span className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-semibold ${readiness.bg} ${readiness.color}`}>
            {readiness.label}
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <ScoreColumn label="Technical" score={report.technical_score} />
          <ScoreColumn label="Communication" score={report.communication_score} />
          <ScoreColumn label="Problem Solving" score={report.problem_solving_score} />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(report.category_breakdown).map(([key, value]) => (
            <CategoryBar key={key} label={formatLabel(key)} score={value} />
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
          <span>Confidence Score:</span>
          <span className="font-medium text-gray-700">{report.confidence_score.toFixed(0)}%</span>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-green-700 mb-3">Strengths</h2>
          <ul className="space-y-2">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-amber-700 mb-3">Areas for Improvement</h2>
          <ul className="space-y-2">
            {report.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">&#9888;</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h2>
        <div className="space-y-2">
          {report.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="bg-primary-100 text-primary-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              {r}
            </div>
          ))}
        </div>
        {report.recommended_topics.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Suggested Topics to Study</p>
            <div className="flex flex-wrap gap-2">
              {report.recommended_topics.map((topic) => (
                <span
                  key={topic}
                  className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full border border-primary-200"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Question-by-Question Review */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Question Review ({report.questions.length} question{report.questions.length !== 1 ? 's' : ''})
        </h2>
        <div className="space-y-6">
          {report.questions.map((q) => (
            <QuestionReview key={q.sequence_number} question={q} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pb-8">
        <button
          onClick={() => navigate('/interview/setup')}
          className="px-8 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 cursor-pointer"
        >
          Start Another Interview
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

function ScoreColumn({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="px-6 py-5 text-center">
      <div className={`text-2xl font-bold ${color}`}>{score.toFixed(1)}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function CategoryBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{score.toFixed(1)}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

function QuestionReview({ question }: { question: ReportResponse['questions'][number] }) {
  const [showModel, setShowModel] = useState(false);

  const scoreColor =
    question.evaluation.overall_score >= 7
      ? 'bg-green-100 text-green-800'
      : question.evaluation.overall_score >= 4
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  const hasModelAnswer = !!question.reference_answer;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Question {question.sequence_number}
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor}`}>
          {question.evaluation.overall_score.toFixed(1)}/10
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{question.question_text}</p>
        </div>
        <div className="bg-primary-50 rounded-lg px-3 py-2">
          <p className="text-xs text-primary-600 font-medium mb-1">Your Answer</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.answer_text}</p>
        </div>
        <div className="text-sm text-gray-600">
          <p className="italic">{question.evaluation.feedback}</p>
        </div>
        {(question.evaluation.strengths.length > 0 || question.evaluation.weaknesses.length > 0) && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {question.evaluation.strengths.length > 0 && (
              <div>
                {question.evaluation.strengths.map((s, i) => (
                  <p key={i} className="text-green-700">+ {s}</p>
                ))}
              </div>
            )}
            {question.evaluation.weaknesses.length > 0 && (
              <div>
                {question.evaluation.weaknesses.map((w, i) => (
                  <p key={i} className="text-amber-700">- {w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {hasModelAnswer && (
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowModel(!showModel)}
              className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            >
              <span className={`inline-block transition-transform duration-200 ${showModel ? 'rotate-90' : ''}`}>
                &#9654;
              </span>
              {showModel ? 'Hide' : 'Show'} Model Answer
            </button>

            {showModel && (
              <div className="mt-3 space-y-3">
                <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                  <p className="text-xs text-emerald-700 font-medium mb-1">Model Answer</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.reference_answer}</p>
                </div>

                {question.expected_concepts && question.expected_concepts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Key Concepts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.matched_concepts?.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 border border-green-200"
                        >
                          &#10003; {c}
                        </span>
                      ))}
                      {question.missed_concepts?.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 border border-orange-200"
                        >
                          &#10007; {c}
                        </span>
                      ))}
                    </div>
                    {question.expected_concepts.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        {question.matched_concepts?.length ?? 0}/{question.expected_concepts.length} concepts covered
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
