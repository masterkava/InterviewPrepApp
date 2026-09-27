import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ensureFreshToken } from '../services/api';
import InterviewerAvatar from '../components/InterviewerAvatar';

type BotState = 'connecting' | 'speaking' | 'listening' | 'processing' | 'finalizing' | 'error' | 'complete';

interface QueuedQuestion {
  id: string;
  sequence_number: number;
  question_text: string;
  difficulty: string;
  skill: string;
  audio_url: string;
}

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1500;
const MIN_SPEECH_DURATION_MS = 500;

interface AudioVAD {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

function createAudioVAD(
  onSpeechEnd: (audioBlob: Blob) => void,
  onSpeechStart: () => void,
): Promise<AudioVAD> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
  }).then(stream => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    let isSpeaking = false;
    let silenceStart = 0;
    let speechStart = 0;
    let chunks: Blob[] = [];
    let rafId = 0;
    let paused = false;
    const dataArray = new Float32Array(analyser.fftSize);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        chunks = [];
        if (blob.size > 1000) onSpeechEnd(blob);
      }
    };

    function detectSpeech() {
      if (paused) { rafId = requestAnimationFrame(detectSpeech); return; }
      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
      const rms = Math.sqrt(sum / dataArray.length);
      const now = Date.now();

      if (rms > SILENCE_THRESHOLD) {
        silenceStart = 0;
        if (!isSpeaking) {
          isSpeaking = true;
          speechStart = now;
          chunks = [];
          recorder.start(100);
          onSpeechStart();
        }
      } else if (isSpeaking) {
        if (silenceStart === 0) silenceStart = now;
        else if (now - silenceStart > SILENCE_DURATION_MS && now - speechStart > MIN_SPEECH_DURATION_MS) {
          isSpeaking = false;
          silenceStart = 0;
          if (recorder.state === 'recording') recorder.stop();
        }
      }
      rafId = requestAnimationFrame(detectSpeech);
    }

    return {
      start: () => { paused = false; rafId = requestAnimationFrame(detectSpeech); },
      stop: () => {
        paused = true;
        cancelAnimationFrame(rafId);
        if (recorder.state === 'recording') recorder.stop();
        stream.getTracks().forEach(t => t.stop());
        audioContext.close();
      },
      pause: () => {
        paused = true;
        if (isSpeaking && recorder.state === 'recording') { recorder.stop(); isSpeaking = false; }
      },
      resume: () => { paused = false; silenceStart = 0; if (!rafId) rafId = requestAnimationFrame(detectSpeech); },
    };
  });
}

export default function LiveInterviewPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();

  const [botState, setBotState] = useState<BotState>('connecting');
  const [currentQuestion, setCurrentQuestion] = useState<QueuedQuestion | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [introMessage, setIntroMessage] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const vadRef = useRef<AudioVAD | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);
  const closingRef = useRef(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<QueuedQuestion[]>([]);
  const currentIndexRef = useRef(0);

  const playTTS = useCallback((audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { audioRef.current = null; resolve(); };
      audio.onerror = () => { audioRef.current = null; resolve(); };
      audio.play().catch(() => resolve());
    });
  }, []);

  const advanceToQuestion = useCallback(async (idx: number) => {
    const queue = queueRef.current;
    if (idx >= queue.length) return;
    const q = queue[idx];
    setCurrentQuestion(q);

    setBotState('speaking');
    vadRef.current?.pause();
    await playTTS(q.audio_url);
    processingRef.current = false;
    setBotState('listening');
    vadRef.current?.resume();
  }, [playTTS]);

  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    (async () => {
      const token = await ensureFreshToken();
      if (!token) { navigate('/login'); return; }
      if (cancelled) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/live/${interviewId}?token=${token}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

    let vadInitialized = false;

    async function initVAD() {
      if (vadInitialized || vadRef.current) return;
      vadInitialized = true;
      try {
        const vad = await createAudioVAD(
          (audioBlob: Blob) => {
            if (processingRef.current) return;
            processingRef.current = true;
            setBotState('processing');
            vad.pause();
            audioBlob.arrayBuffer().then(buf => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(buf);
              }
            });
          },
          () => {
            if (!processingRef.current) setBotState('listening');
          },
        );
        vadRef.current = vad;
        vad.start();
      } catch (err) {
        console.error('Microphone init failed:', err);
        setErrorMessage('Failed to access microphone. Please allow microphone access and reload.');
        setBotState('error');
      }
    }

    ws.onopen = () => {
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 30000);
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'queue': {
          const queue: QueuedQuestion[] = data.questions;
          queueRef.current = queue;
          setTotalQuestions(data.total);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          setIntroMessage(data.interviewer_message);

          await initVAD();
          await advanceToQuestion(0);
          break;
        }

        case 'processing':
          setBotState('processing');
          vadRef.current?.pause();
          break;

        case 'transcript':
        case 'evaluation':
          break;

        case 'next': {
          const nextIdx = currentIndexRef.current + 1;
          currentIndexRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          await advanceToQuestion(nextIdx);
          break;
        }

        case 'finalizing':
          setBotState('finalizing');
          vadRef.current?.pause();
          break;

        case 'complete':
          setBotState('complete');
          vadRef.current?.pause();
          break;

        case 'error':
          setErrorMessage(data.message);
          processingRef.current = false;
          setBotState('listening');
          vadRef.current?.resume();
          break;
      }
    };

    ws.onerror = () => {
      if (!closingRef.current) {
        setErrorMessage('Connection error.');
        setBotState('error');
      }
    };

    ws.onclose = (event) => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (!closingRef.current && event.code !== 1000) {
        setBotState(prev => {
          if (prev !== 'complete') {
            setErrorMessage('Connection lost. Please reload to reconnect.');
            return 'error';
          }
          return prev;
        });
      }
    };

    })();

    return () => {
      cancelled = true;
      closingRef.current = true;
      if (pingRef.current) clearInterval(pingRef.current);
      vadRef.current?.stop();
      vadRef.current = null;
      audioRef.current?.pause();
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
    };
  }, [interviewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEndInterview = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
  }, []);

  const handleViewReport = useCallback(() => {
    navigate(`/interview/${interviewId}/complete`);
  }, [navigate, interviewId]);

  const avatarState = botState === 'speaking' ? 'speaking'
    : (botState === 'processing' || botState === 'finalizing') ? 'thinking'
    : 'idle';

  const progressPct = totalQuestions > 0 ? Math.round(((currentIndex) / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col text-white">
      {/* Top bar */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {totalQuestions > 0 && (
            <span className="text-sm text-gray-400 font-medium">
              Question {Math.min(currentIndex + 1, totalQuestions)} of {totalQuestions}
            </span>
          )}
        </div>
        {botState !== 'complete' && botState !== 'connecting' && (
          <button
            onClick={handleEndInterview}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors cursor-pointer"
          >
            End Interview
          </button>
        )}
      </header>

      {/* Progress bar */}
      {totalQuestions > 0 && (
        <div className="mx-6 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {/* Connecting state */}
        {botState === 'connecting' && (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <InterviewerAvatar state="thinking" size="xl" />
            <p className="text-gray-400 text-lg">Preparing your interview...</p>
          </div>
        )}

        {/* Interview in progress */}
        {botState !== 'connecting' && botState !== 'complete' && botState !== 'error' && (
          <>
            {/* Avatar with animated rings */}
            <div className="relative">
              {/* Pulse rings for speaking */}
              {botState === 'speaking' && (
                <>
                  <div className="absolute inset-0 -m-4 rounded-full bg-primary-500/20 animate-ping [animation-duration:2s]" />
                  <div className="absolute inset-0 -m-8 rounded-full bg-primary-500/10 animate-ping [animation-duration:2.5s]" />
                </>
              )}
              {/* Pulse rings for listening */}
              {botState === 'listening' && (
                <>
                  <div className="absolute inset-0 -m-4 rounded-full bg-red-500/15 animate-pulse [animation-duration:1.5s]" />
                  <div className="absolute inset-0 -m-8 rounded-full bg-red-500/8 animate-pulse [animation-duration:2s]" />
                </>
              )}
              {/* Processing ring */}
              {(botState === 'processing' || botState === 'finalizing') && (
                <div className="absolute inset-0 -m-5 rounded-full border-2 border-primary-400/30 border-t-primary-400 animate-spin" />
              )}
              <InterviewerAvatar state={avatarState} size="xl" />
            </div>

            {/* Status label */}
            <div className="flex items-center gap-3">
              {botState === 'speaking' && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="block w-1.5 h-3 bg-primary-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="block w-1.5 h-4 bg-primary-500 rounded-full animate-bounce [animation-delay:100ms]" />
                    <span className="block w-1.5 h-5 bg-primary-400 rounded-full animate-bounce [animation-delay:200ms]" />
                    <span className="block w-1.5 h-4 bg-primary-500 rounded-full animate-bounce [animation-delay:100ms]" />
                    <span className="block w-1.5 h-3 bg-primary-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  </div>
                  <span className="text-primary-300 text-sm font-medium">Interviewer is speaking...</span>
                </>
              )}
              {botState === 'listening' && (
                <>
                  <span className="block w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-300 text-sm font-medium">Listening — speak your answer...</span>
                </>
              )}
              {botState === 'processing' && (
                <>
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-primary-400 rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm font-medium">Processing your answer...</span>
                </>
              )}
              {botState === 'finalizing' && (
                <>
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-primary-400 rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm font-medium">Finalizing your results...</span>
                </>
              )}
            </div>

            {/* Current question */}
            {currentQuestion && (
              <div className="max-w-2xl text-center">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-3 font-medium">
                  {currentQuestion.skill} &middot; {currentQuestion.difficulty}
                </p>
                <p className="text-xl md:text-2xl font-medium text-gray-100 leading-relaxed">
                  "{currentQuestion.question_text}"
                </p>
              </div>
            )}

            {/* Intro message on first load */}
            {!currentQuestion && introMessage && (
              <p className="text-gray-400 text-center max-w-lg">{introMessage}</p>
            )}
          </>
        )}

        {/* Complete state */}
        {botState === 'complete' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Interview Complete</h2>
              <p className="text-gray-400 mb-8">Great job! Your detailed performance report is ready.</p>
              <button
                onClick={handleViewReport}
                className="px-8 py-3 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 cursor-pointer"
              >
                View Report
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {botState === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-red-300 text-center">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors cursor-pointer"
            >
              Reload
            </button>
          </div>
        )}
      </main>

      {/* Subtle footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-gray-600">
          {botState === 'listening' && 'Your microphone is active. Speak naturally — the AI will detect when you finish.'}
          {botState === 'speaking' && 'Listen carefully to the question before answering.'}
          {botState === 'processing' && 'Your answer is being transcribed and evaluated.'}
          {botState === 'finalizing' && 'Almost done — evaluating remaining answers.'}
        </p>
      </footer>
    </div>
  );
}
