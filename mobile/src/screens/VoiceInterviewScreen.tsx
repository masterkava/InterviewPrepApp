import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import {
  textToSpeech,
  getAudioUrl,
  speechToText,
  submitAnswer,
  completeInterview,
} from '../services/api';
import AudioPlayer from '../components/AudioPlayer';
import AudioRecorder from '../components/AudioRecorder';
import type { Question, Progress } from '../types/interview';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VoiceInterview'>;
type Route = RouteProp<RootStackParamList, 'VoiceInterview'>;

type Phase = 'playing' | 'recording' | 'transcribing' | 'review' | 'submitting' | 'feedback';

export default function VoiceInterviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { interviewId, firstQuestion, progress: initialProgress } = route.params;

  const [question, setQuestion] = useState<Question>(firstQuestion);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [phase, setPhase] = useState<Phase>('playing');
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const startTimeRef = useRef(Date.now());

  const loadTTS = useCallback(async (text: string) => {
    try {
      const res = await textToSpeech(text);
      setTtsUrl(getAudioUrl(res.audio_url));
    } catch {
      Alert.alert('TTS Error', 'Could not generate audio for this question. Reading as text instead.');
      setPhase('recording');
    }
  }, []);

  React.useEffect(() => {
    loadTTS(question.question_text);
    startTimeRef.current = Date.now();
  }, [question.question_text, loadTTS]);

  const handlePlaybackFinished = () => {
    setPhase('recording');
  };

  const handleRecordingComplete = async (uri: string) => {
    setRecordingUri(uri);
    setPhase('transcribing');

    try {
      const result = await speechToText(uri);
      setTranscribedText(result.text);
      setPhase('review');
    } catch (err: any) {
      const msg = err?.message || String(err);
      Alert.alert('Transcription Error', `${msg}\n\nRecording URI: ${uri}`);
      setTranscribedText('');
      setPhase('review');
    }
  };

  const handleSubmit = async () => {
    if (!transcribedText.trim()) {
      Alert.alert('Empty Answer', 'Please record or type your answer before submitting.');
      return;
    }

    setPhase('submitting');

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const result = await submitAnswer(interviewId, {
        question_id: question.id,
        answer_text: transcribedText.trim(),
        response_time_seconds: elapsed,
      });

      setFeedback(result.evaluation.feedback);
      setProgress(result.progress);
      setPhase('feedback');

      if (result.interview_complete || !result.next_question) {
        try {
          await completeInterview(interviewId);
        } catch {
          // Already completed by the backend — safe to ignore
        }
        setTimeout(() => {
          navigation.replace('InterviewComplete', { interviewId });
        }, 3000);
      } else {
        const nextQ = result.next_question;
        setTimeout(() => {
          setQuestion(nextQ);
          setPhase('playing');
          setTtsUrl(null);
          setTranscribedText('');
          setFeedback(null);
          setRecordingUri(null);
          scrollRef.current?.scrollTo({ y: 0 });
        }, 3000);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit answer');
      setPhase('review');
    }
  };

  const handleReRecord = () => {
    setTranscribedText('');
    setRecordingUri(null);
    setPhase('recording');
  };

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress Bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Question {progress.current} of {progress.total}
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(progress.current / progress.total) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Question Card */}
      <View style={styles.questionCard}>
        <View style={styles.questionMeta}>
          <Text style={styles.badge}>{question.difficulty}</Text>
          <Text style={styles.badge}>{question.skill}</Text>
        </View>
        <Text style={styles.questionText}>{question.question_text}</Text>
      </View>

      {/* Phase: Playing TTS */}
      {phase === 'playing' && ttsUrl && (
        <AudioPlayer
          audioUrl={ttsUrl}
          onFinished={handlePlaybackFinished}
          autoPlay
        />
      )}

      {phase === 'playing' && !ttsUrl && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Generating question audio...</Text>
        </View>
      )}

      {/* Phase: Recording */}
      {phase === 'recording' && (
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      )}

      {/* Phase: Transcribing */}
      {phase === 'transcribing' && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Transcribing your answer...</Text>
        </View>
      )}

      {/* Phase: Review */}
      {phase === 'review' && (
        <>
          <Text style={styles.sectionLabel}>Your Answer</Text>
          <TextInput
            style={styles.textInput}
            value={transcribedText}
            onChangeText={setTranscribedText}
            multiline
            textAlignVertical="top"
            placeholder="Edit your transcribed answer or type manually..."
            placeholderTextColor={colors.textLight}
          />

          <View style={styles.reviewActions}>
            <TouchableOpacity style={styles.reRecordBtn} onPress={handleReRecord}>
              <Text style={styles.reRecordText}>Re-record</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Phase: Submitting */}
      {phase === 'submitting' && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Evaluating your answer...</Text>
        </View>
      )}

      {/* Phase: Feedback */}
      {phase === 'feedback' && feedback && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackLabel}>Feedback</Text>
          <Text style={styles.feedbackText}>{feedback}</Text>
          <Text style={styles.nextHint}>Moving to next question...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  progressRow: {
    marginBottom: spacing.lg,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  questionMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    fontSize: fontSize.xs,
    color: colors.primary,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  questionText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 24,
  },
  loadingBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reRecordBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  reRecordText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  feedbackCard: {
    backgroundColor: '#F0FDF4',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  feedbackLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.success,
    marginBottom: spacing.sm,
  },
  feedbackText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  nextHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
});
