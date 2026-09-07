import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getUserInterviews } from '../services/api';
import { useSessionId } from '../hooks/useSessionId';
import type { InterviewHistoryItem } from '../types/interview';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: 'text-green-800', bg: 'bg-green-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-800', bg: 'bg-blue-100' },
  configured: { label: 'Not Started', color: 'text-gray-800', bg: 'bg-gray-100' },
};

const PAGE_SIZE = 10;

export default function InterviewHistoryPage() {
  const navigate = useNavigate();
  const userId = useSessionId();
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['history', userId, page],
    queryFn: () => getUserInterviews(userId, PAGE_SIZE, page * PAGE_SIZE),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interview History</h1>
          <p className="mt-1 text-gray-500">Review your past interview sessions and scores</p>
        </div>
        <button
          onClick={() => navigate('/interview/setup')}
          className="px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 cursor-pointer"
        >
          New Interview
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load interview history.
        </div>
      )}

      {data && data.interviews.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">&#x1f4cb;</div>
          <h2 className="text-xl font-semibold text-gray-700">No interviews yet</h2>
          <p className="mt-2 text-gray-500">Start your first mock interview to see your history here.</p>
          <button
            onClick={() => navigate('/interview/setup')}
            className="mt-6 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors cursor-pointer"
          >
            Start Your First Interview
          </button>
        </div>
      )}

      {data && data.interviews.length > 0 && (
        <>
          <div className="space-y-3">
            {data.interviews.map((interview) => (
              <HistoryCard key={interview.id} interview={interview} />
            ))}
          </div>

          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= data.total}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryCard({ interview }: { interview: InterviewHistoryItem }) {
  const navigate = useNavigate();
  const status = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.configured;
  const hasReport = interview.status === 'completed' && interview.overall_score != null;

  const scoreColor =
    interview.overall_score != null
      ? interview.overall_score >= 70
        ? 'text-green-600'
        : interview.overall_score >= 50
          ? 'text-amber-600'
          : 'text-red-600'
      : 'text-gray-400';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div
      onClick={() => hasReport && navigate(`/interview/${interview.id}/report`)}
      className={`bg-white rounded-xl border border-gray-200 p-5 transition-all ${
        hasReport
          ? 'hover:border-primary-300 hover:shadow-md cursor-pointer'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900 truncate">{interview.role_name}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="capitalize">{interview.experience_level}</span>
            <span>&#x2022;</span>
            <span>{interview.questions_asked} question{interview.questions_asked !== 1 ? 's' : ''}</span>
            <span>&#x2022;</span>
            <span>{formatDate(interview.completed_at ?? interview.started_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          {interview.overall_score != null ? (
            <div className="text-right">
              <div className={`text-2xl font-bold ${scoreColor}`}>
                {interview.overall_score.toFixed(1)}
              </div>
              <div className="text-xs text-gray-400">Score</div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-lg text-gray-300">—</div>
              <div className="text-xs text-gray-400">No score</div>
            </div>
          )}

          {hasReport && (
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
