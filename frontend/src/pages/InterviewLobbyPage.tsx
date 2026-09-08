import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { startInterview } from '../services/api';
import InterviewerAvatar from '../components/InterviewerAvatar';
import type { InterviewMode } from '../types/interview';

export default function InterviewLobbyPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const interviewMode: InterviewMode =
    (location.state as { interview_mode?: InterviewMode })?.interview_mode ?? 'text';

  const sessionRoute = interviewMode === 'voice' ? 'voice-session' : 'session';

  const startMutation = useMutation({
    mutationFn: () => startInterview(interviewId!),
    onSuccess: (data) => {
      navigate(`/interview/${interviewId}/${sessionRoute}`, {
        state: {
          startData: data,
          interview_mode: interviewMode,
        },
        replace: true,
      });
    },
  });

  if (!interviewId) {
    navigate('/');
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-8 py-10 text-center text-white">
          <InterviewerAvatar state="idle" size="lg" />
          <h1 className="mt-4 text-2xl font-bold">Your Interviewer is Ready</h1>
          <p className="mt-2 text-primary-100">
            Take a deep breath. This is a safe space to practice.
          </p>
        </div>

        {/* Instructions */}
        <div className="px-8 py-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Before You Begin</h2>
          {interviewMode === 'voice' && (
            <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <span><strong>Voice Mode</strong> — Questions will be spoken aloud. Use your microphone to answer.</span>
            </div>
          )}
          <ul className="space-y-3">
            <Instruction
              number={1}
              text="You'll receive questions one at a time. Take your time to think before answering."
            />
            <Instruction
              number={2}
              text={interviewMode === 'voice'
                ? "Click the microphone button to record your answer. You can review the transcript before submitting."
                : "Type your answers as you would speak in a real interview. Be clear and structured."
              }
            />
            <Instruction
              number={3}
              text="After each answer, the AI evaluates your response and may ask a follow-up."
            />
            <Instruction
              number={4}
              text="When done, you'll receive a detailed performance report with actionable feedback."
            />
          </ul>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Tip:</strong> Structure your answers with a brief statement, explanation,
            and example when possible. Quality matters more than length.
          </div>

          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="mt-8 w-full py-4 rounded-xl bg-primary-600 text-white font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {startMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Starting Interview...
              </span>
            ) : (
              "Begin Interview"
            )}
          </button>

          {startMutation.error && (
            <p className="mt-3 text-sm text-red-600 text-center">
              {startMutation.error instanceof Error
                ? startMutation.error.message
                : 'Failed to start interview. Please try again.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Instruction({ number, text }: { number: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
        {number}
      </span>
      <span className="text-gray-700 text-sm leading-relaxed pt-0.5">{text}</span>
    </li>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
