import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { completeInterview, submitAnswer } from '../services/api';
import InterviewerAvatar from '../components/InterviewerAvatar';
import type {
  AnswerResponse,
  ConversationEntry,
  InterviewStartResponse,
  Progress,
  Question,
} from '../types/interview';

export default function InterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const startData = (location.state as { startData?: InterviewStartResponse })?.startData;

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    startData?.question ?? null,
  );
  const [progress, setProgress] = useState<Progress | null>(startData?.progress ?? null);
  const [answerText, setAnswerText] = useState('');
  const [conversation, setConversation] = useState<ConversationEntry[]>(() => {
    const entries: ConversationEntry[] = [];
    if (startData?.interviewer_message) {
      entries.push({
        type: 'system',
        text: startData.interviewer_message,
        timestamp: Date.now(),
      });
    }
    if (startData?.question) {
      entries.push({
        type: 'question',
        text: startData.question.question_text,
        question: startData.question,
        timestamp: Date.now(),
      });
    }
    return entries;
  });
  const [answerStartTime, setAnswerStartTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avatarState, setAvatarState] = useState<'idle' | 'thinking' | 'speaking'>('idle');

  const conversationEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!startData) {
      navigate(`/interview/${interviewId}/lobby`, { replace: true });
    }
  }, [startData, interviewId, navigate]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Reset answer timer on new question
  useEffect(() => {
    setAnswerStartTime(Date.now());
    textareaRef.current?.focus();
  }, [currentQuestion?.id]);

  const answerMutation = useMutation({
    mutationFn: (text: string) => {
      const responseTime = Math.round((Date.now() - answerStartTime) / 1000);
      return submitAnswer(interviewId!, {
        question_id: currentQuestion!.id,
        answer_text: text,
        response_time_seconds: responseTime,
      });
    },
    onMutate: () => {
      setAvatarState('thinking');
    },
    onSuccess: (data: AnswerResponse) => {
      setAvatarState('idle');

      // Add evaluation to conversation
      setConversation((prev) => [
        ...prev,
        {
          type: 'system' as const,
          text: data.evaluation.feedback,
          evaluation: data.evaluation,
          timestamp: Date.now(),
        },
      ]);

      setProgress(data.progress);

      if (data.interview_complete) {
        if (data.closing_message) {
          setConversation((prev) => [
            ...prev,
            { type: 'system', text: data.closing_message!, timestamp: Date.now() },
          ]);
        }
        setTimeout(() => {
          navigate(`/interview/${interviewId}/complete`, { replace: true });
        }, 2000);
        setCurrentQuestion(null);
      } else if (data.next_question) {
        setCurrentQuestion(data.next_question);
        setConversation((prev) => [
          ...prev,
          {
            type: 'question',
            text: data.next_question!.question_text,
            question: data.next_question!,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    onError: () => {
      setAvatarState('idle');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeInterview(interviewId!),
    onSuccess: () => {
      navigate(`/interview/${interviewId}/complete`, { replace: true });
    },
  });

  const handleSubmit = useCallback(() => {
    const trimmed = answerText.trim();
    if (!trimmed || !currentQuestion || answerMutation.isPending) return;

    setConversation((prev) => [
      ...prev,
      { type: 'answer', text: trimmed, timestamp: Date.now() },
    ]);
    setAnswerText('');
    answerMutation.mutate(trimmed);
  }, [answerText, currentQuestion, answerMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!startData) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-5xl mx-auto px-4 py-4">
      {/* Top bar: progress + timer + end button */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>
              Question {progress?.current ?? 0} of {progress?.total ?? 0}
            </span>
            <span className="font-mono text-gray-500">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          {progress && progress.skills_covered.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {progress.skills_covered.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full"
                >
                  {skill}
                </span>
              ))}
              {progress.skills_remaining.map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          End Interview
        </button>
      </div>

      {/* Conversation area */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        {conversation.map((entry, i) => (
          <ConversationBubble key={i} entry={entry} avatarState={avatarState} />
        ))}

        {answerMutation.isPending && (
          <div className="flex items-start gap-3">
            <InterviewerAvatar state="thinking" size="sm" />
            <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 max-w-[70%]">
              <span className="flex items-center gap-1.5">
                Evaluating your answer
                <span className="flex gap-0.5">
                  <span className="block w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="block w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="block w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              </span>
            </div>
          </div>
        )}

        <div ref={conversationEndRef} />
      </div>

      {/* Answer input */}
      {currentQuestion && (
        <div className="mt-4 flex gap-3">
          <textarea
            ref={textareaRef}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer... (Ctrl+Enter to submit)"
            disabled={answerMutation.isPending}
            rows={3}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={handleSubmit}
            disabled={!answerText.trim() || answerMutation.isPending}
            className="self-end px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Submit
          </button>
        </div>
      )}

      {answerMutation.error && (
        <p className="mt-2 text-sm text-red-600">
          Failed to submit answer. Please try again.
        </p>
      )}
    </div>
  );
}

function ConversationBubble({
  entry,
  avatarState,
}: {
  entry: ConversationEntry;
  avatarState: string;
}) {
  if (entry.type === 'answer') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary-600 text-white rounded-xl px-4 py-3 text-sm max-w-[70%] whitespace-pre-wrap">
          {entry.text}
        </div>
      </div>
    );
  }

  const isQuestion = entry.type === 'question';
  const hasEvaluation = entry.evaluation != null;

  return (
    <div className="flex items-start gap-3">
      <InterviewerAvatar state="idle" size="sm" />
      <div className="max-w-[75%] space-y-2">
        <div
          className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
            isQuestion
              ? 'bg-primary-50 border border-primary-100 text-gray-900'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {isQuestion && entry.question && (
            <div className="flex items-center gap-2 mb-1.5 text-xs text-primary-600">
              <span className="font-medium">Q{entry.question.sequence_number}</span>
              <span className="text-primary-300">|</span>
              <span className="capitalize">{entry.question.skill}</span>
              <span className="text-primary-300">|</span>
              <span className="capitalize">{entry.question.difficulty}</span>
            </div>
          )}
          {entry.text}
        </div>

        {hasEvaluation && entry.evaluation && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-3 mb-1">
              <ScoreBadge score={entry.evaluation.overall_score} />
              <span className="text-gray-500">Score</span>
            </div>
            {entry.evaluation.strengths.length > 0 && (
              <div className="text-green-700 mt-1">
                <span className="font-medium">+</span>{' '}
                {entry.evaluation.strengths.join(' | ')}
              </div>
            )}
            {entry.evaluation.weaknesses.length > 0 && (
              <div className="text-amber-700 mt-1">
                <span className="font-medium">-</span>{' '}
                {entry.evaluation.weaknesses.join(' | ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 7
      ? 'bg-green-100 text-green-800'
      : score >= 4
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      {score.toFixed(1)}/10
    </span>
  );
}
