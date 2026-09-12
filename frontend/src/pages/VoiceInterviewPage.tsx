import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  completeInterview,
  submitAnswer,
  textToSpeech,
  speechToText,
  uploadAudio,
} from '../services/api';
import InterviewerAvatar from '../components/InterviewerAvatar';
import type {
  AnswerResponse,
  InterviewStartResponse,
  Progress,
  Question,
} from '../types/interview';

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'reviewing';

export default function VoiceInterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const startData = (location.state as { startData?: InterviewStartResponse })?.startData;

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
    startData?.question ?? null,
  );
  const [progress, setProgress] = useState<Progress | null>(startData?.progress ?? null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avatarState, setAvatarState] = useState<'idle' | 'thinking' | 'speaking'>('idle');

  // Voice-specific state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingQuestion, setIsPlayingQuestion] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState(Date.now());

  // Feedback history for showing evaluations
  const [feedbackHistory, setFeedbackHistory] = useState<
    Array<{ questionNum: number; score: number; feedback: string; strengths: string[]; weaknesses: string[] }>
  >([]);

  useEffect(() => {
    if (!startData) {
      navigate(`/interview/${interviewId}/lobby`, { replace: true });
    }
  }, [startData, interviewId, navigate]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Play TTS when a new question arrives
  useEffect(() => {
    if (!currentQuestion) return;
    setAnswerStartTime(Date.now());
    setTranscript('');
    setAudioBlob(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    setTtsError(null);
    playQuestionTTS(currentQuestion.question_text);
  }, [currentQuestion?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (questionAudioRef.current) {
        questionAudioRef.current.pause();
        questionAudioRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const playQuestionTTS = async (text: string) => {
    setAvatarState('speaking');
    setIsPlayingQuestion(true);
    try {
      const { audio_url } = await textToSpeech(text);
      const fullUrl = audio_url;
      const audio = new Audio(fullUrl);
      questionAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingQuestion(false);
        setAvatarState('idle');
      };
      audio.onerror = () => {
        setIsPlayingQuestion(false);
        setAvatarState('idle');
        setTtsError('Failed to play question audio');
      };
      await audio.play();
    } catch {
      setIsPlayingQuestion(false);
      setAvatarState('idle');
      setTtsError('Failed to generate speech. Question is shown as text below.');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        transcribeAudio(blob);
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setTtsError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('transcribing');
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    try {
      const { text } = await speechToText(blob);
      setTranscript(text);
      setRecordingState('reviewing');
    } catch {
      setTranscript('');
      setRecordingState('reviewing');
      setTtsError('Transcription failed. You can type your answer manually.');
    }
  };

  const reRecord = () => {
    setAudioBlob(null);
    setTranscript('');
    setRecordingState('idle');
    setRecordingDuration(0);
  };

  const answerMutation = useMutation({
    mutationFn: async (text: string) => {
      const responseTime = Math.round((Date.now() - answerStartTime) / 1000);
      let audioUrl: string | undefined;
      if (audioBlob) {
        const uploadResult = await uploadAudio(audioBlob);
        audioUrl = uploadResult.audio_url;
      }
      return submitAnswer(interviewId!, {
        question_id: currentQuestion!.id,
        answer_text: text,
        response_time_seconds: responseTime,
        audio_url: audioUrl,
      });
    },
    onMutate: () => {
      setAvatarState('thinking');
    },
    onSuccess: (data: AnswerResponse) => {
      setAvatarState('idle');

      setFeedbackHistory((prev) => [
        ...prev,
        {
          questionNum: currentQuestion!.sequence_number,
          score: data.evaluation.overall_score,
          feedback: data.evaluation.feedback,
          strengths: data.evaluation.strengths,
          weaknesses: data.evaluation.weaknesses,
        },
      ]);

      setProgress(data.progress);
      setRecordingState('idle');
      setTranscript('');
      setAudioBlob(null);

      if (data.interview_complete) {
        setTimeout(() => {
          navigate(`/interview/${interviewId}/complete`, { replace: true });
        }, 2500);
        setCurrentQuestion(null);
      } else if (data.next_question) {
        setCurrentQuestion(data.next_question);
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
    const trimmed = transcript.trim();
    if (!trimmed || !currentQuestion || answerMutation.isPending) return;
    answerMutation.mutate(trimmed);
  }, [transcript, currentQuestion, answerMutation]);

  if (!startData) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col max-w-4xl mx-auto px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Question {progress?.current ?? 0} of {progress?.total ?? 0}</span>
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
                <span key={skill} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                  {skill}
                </span>
              ))}
              {progress.skills_remaining.map((skill) => (
                <span key={skill} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
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

      {/* Main content area */}
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
        {/* Interviewer section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <InterviewerAvatar state={avatarState} size="lg" />
            <div className="flex-1">
              {currentQuestion ? (
                <>
                  <div className="flex items-center gap-2 mb-2 text-xs text-primary-600">
                    <span className="font-medium">Q{currentQuestion.sequence_number}</span>
                    <span className="text-primary-300">|</span>
                    <span className="capitalize">{currentQuestion.skill}</span>
                    <span className="text-primary-300">|</span>
                    <span className="capitalize">{currentQuestion.difficulty}</span>
                  </div>
                  <p className="text-gray-900 text-lg leading-relaxed">
                    {currentQuestion.question_text}
                  </p>
                  {isPlayingQuestion && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-primary-600">
                      <SoundWave />
                      <span>Speaking...</span>
                    </div>
                  )}
                  {ttsError && (
                    <p className="mt-2 text-xs text-amber-600">{ttsError}</p>
                  )}
                  {!isPlayingQuestion && !ttsError && (
                    <button
                      onClick={() => playQuestionTTS(currentQuestion.question_text)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.788v6.424a.75.75 0 001.03.693l7.72-3.212a.75.75 0 000-1.386l-7.72-3.212a.75.75 0 00-1.03.693z" />
                      </svg>
                      Replay question
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-500 text-lg">
                  Interview complete. Generating your report...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Latest feedback */}
        {feedbackHistory.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Previous Answer (Q{feedbackHistory[feedbackHistory.length - 1].questionNum})
            </div>
            <div className="flex items-center gap-3 mb-2">
              <ScoreBadge score={feedbackHistory[feedbackHistory.length - 1].score} />
              <span className="text-sm text-gray-700">{feedbackHistory[feedbackHistory.length - 1].feedback}</span>
            </div>
            {feedbackHistory[feedbackHistory.length - 1].strengths.length > 0 && (
              <div className="text-xs text-green-700">
                <span className="font-medium">+</span>{' '}
                {feedbackHistory[feedbackHistory.length - 1].strengths.join(' | ')}
              </div>
            )}
            {feedbackHistory[feedbackHistory.length - 1].weaknesses.length > 0 && (
              <div className="text-xs text-amber-700 mt-1">
                <span className="font-medium">-</span>{' '}
                {feedbackHistory[feedbackHistory.length - 1].weaknesses.join(' | ')}
              </div>
            )}
          </div>
        )}

        {/* Recording / Answer section */}
        {currentQuestion && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {answerMutation.isPending ? (
              <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
                <Spinner />
                <span>Evaluating your answer...</span>
              </div>
            ) : recordingState === 'idle' ? (
              <div className="flex flex-col items-center py-6">
                <p className="text-sm text-gray-500 mb-4">
                  {isPlayingQuestion ? 'Listen to the question, then record your answer' : 'Click the microphone to start recording your answer'}
                </p>
                <button
                  onClick={startRecording}
                  disabled={isPlayingQuestion}
                  className="w-20 h-20 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg hover:shadow-xl active:scale-95"
                >
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            ) : recordingState === 'recording' ? (
              <div className="flex flex-col items-center py-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-red-600">Recording</span>
                  <span className="font-mono text-sm text-gray-500">{formatTime(recordingDuration)}</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-95"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
                <p className="mt-3 text-xs text-gray-400">Click to stop recording</p>
              </div>
            ) : recordingState === 'transcribing' ? (
              <div className="flex flex-col items-center py-8 text-gray-500">
                <Spinner />
                <p className="mt-3 text-sm">Transcribing your answer...</p>
              </div>
            ) : (
              /* reviewing */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Your Answer</span>
                  <span className="text-xs text-gray-400">Duration: {formatTime(recordingDuration)}</span>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Transcript will appear here. You can edit it before submitting."
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={reRecord}
                    className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Re-record
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!transcript.trim()}
                    className="flex-1 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary-600/25"
                  >
                    Submit Answer
                  </button>
                </div>
              </div>
            )}

            {answerMutation.error && (
              <p className="mt-3 text-sm text-red-600 text-center">
                Failed to submit answer. Please try again.
              </p>
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

function SoundWave() {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 3, 2, 4, 2, 3, 1].map((h, i) => (
        <div
          key={i}
          className="w-0.5 bg-primary-500 rounded-full animate-pulse"
          style={{
            height: `${h * 4}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6 text-primary-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
