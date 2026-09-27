import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { submitAnswer, completeInterview } from '../services/api';
import type { Question, Progress } from '../types/interview';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Interview'>;
type Route = RouteProp<RootStackParamList, 'Interview'>;

export default function InterviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { interviewId, firstQuestion, progress: initialProgress } = route.params;

  const [question, setQuestion] = useState<Question>(firstQuestion);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const startTimeRef = useRef(Date.now());

  const handleSubmit = async () => {
    if (!answerText.trim()) {
      Alert.alert('Empty Answer', 'Please type your answer before submitting.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const result = await submitAnswer(interviewId, {
        question_id: question.id,
        answer_text: answerText.trim(),
        response_time_seconds: elapsed,
      });

      setFeedback(result.evaluation.feedback);
      setProgress(result.progress);

      if (result.interview_complete || !result.next_question) {
        try {
          await completeInterview(interviewId);
        } catch {
          // Already completed by the backend — safe to ignore
        }
        setTimeout(() => {
          navigation.replace('InterviewComplete', { interviewId });
        }, 2000);
      } else {
        setTimeout(() => {
          setQuestion(result.next_question!);
          setAnswerText('');
          setFeedback(null);
          startTimeRef.current = Date.now();
          scrollRef.current?.scrollTo({ y: 0 });
        }, 2500);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
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

        {/* Answer Input */}
        <TextInput
          style={styles.textInput}
          placeholder="Type your answer here..."
          placeholderTextColor={colors.textLight}
          value={answerText}
          onChangeText={setAnswerText}
          multiline
          textAlignVertical="top"
          editable={!submitting && !feedback}
        />

        {/* Feedback */}
        {feedback && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackLabel}>Feedback</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}

        {/* Submit Button */}
        {!feedback && (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
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
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 150,
    marginBottom: spacing.lg,
  },
  feedbackCard: {
    backgroundColor: '#F0FDF4',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: spacing.lg,
  },
  feedbackLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  feedbackText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
