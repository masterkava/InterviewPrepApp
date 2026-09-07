import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQuestionBank, getQuestionBankMeta } from '../services/api';
import type { QuestionBankItem } from '../types/interview';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  hard: 'bg-red-100 text-red-800',
  expert: 'bg-purple-100 text-purple-800',
};

export default function QuestionBankPage() {
  const [category, setCategory] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: meta } = useQuery({
    queryKey: ['question-bank-meta'],
    queryFn: getQuestionBankMeta,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['question-bank', category, topic, difficulty, search, page],
    queryFn: () =>
      getQuestionBank({
        category: category || undefined,
        topic: topic || undefined,
        difficulty: difficulty || undefined,
        search: search || undefined,
        page,
        limit,
      }),
  });

  const currentCategory = meta?.categories.find((c) => c.slug === category);
  const topics = currentCategory?.topics ?? [];

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setTopic('');
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
        <p className="mt-1 text-gray-500">
          {meta ? `${meta.total.toLocaleString()} questions across ${meta.categories.length} categories` : 'Loading...'}
        </p>
      </div>

      {/* Category pills */}
      {meta && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              category === ''
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({meta.total})
          </button>
          {meta.categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                category === cat.slug
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {topics.length > 0 && (
          <select
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <select
          value={difficulty}
          onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search questions..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer"
          >
            Search
          </button>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : data && data.questions.length > 0 ? (
        <>
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total} questions
          </p>
          <div className="space-y-4">
            {data.questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-default"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {data.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-default"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No questions found. Try adjusting your filters.
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: QuestionBankItem }) {
  const [expanded, setExpanded] = useState(false);
  const diffColor = DIFFICULTY_COLORS[question.difficulty.toLowerCase()] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{question.id}</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${diffColor}`}>
              {question.difficulty}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              {question.topic}
            </span>
            {question.category_label && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {question.category_label}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm font-medium text-gray-900 mb-3">{question.question_text}</p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
        >
          <span className={`inline-block transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            &#9654;
          </span>
          {expanded ? 'Hide' : 'Show'} Answer
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div className="bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-200">
              <p className="text-xs text-emerald-700 font-medium mb-1">Model Answer</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.answer}</p>
            </div>

            {question.key_concepts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Key Concepts</p>
                <div className="flex flex-wrap gap-1.5">
                  {question.key_concepts.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
