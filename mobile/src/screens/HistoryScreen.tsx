import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { getUserInterviews, resumeInterview } from '../services/api';
import { ListSkeleton } from '../components/SkeletonLoader';
import type { InterviewHistoryItem } from '../types/interview';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  completed: { label: 'Completed', color: '#065F46', bgColor: '#D1FAE5' },
  in_progress: { label: 'In Progress', color: '#1E40AF', bgColor: '#DBEAFE' },
  configured: { label: 'Not Started', color: '#374151', bgColor: '#F3F4F6' },
};

function getScoreColor(score: number): string {
  if (score >= 70) return colors.success;
  if (score >= 50) return colors.warning;
  return colors.error;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const mins = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000,
  );
  if (mins < 1) return '<1 min';
  return `${mins} min`;
}

const HistoryCard = React.memo(function HistoryCard({
  item,
  onPress,
}: {
  item: InterviewHistoryItem;
  onPress: (id: string) => void;
}) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.configured;
  const isCompleted = item.status === 'completed';
  const duration = formatDuration(item.started_at, item.completed_at);
  const dateStr = formatDate(item.completed_at ?? item.started_at);

  const actionLabel = isCompleted
    ? 'View Report'
    : item.status === 'in_progress'
      ? 'Resume'
      : item.status === 'configured'
        ? 'Start'
        : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.roleName} numberOfLines={1}>
          {item.role_name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>{item.experience_level}</Text>
        <Text style={styles.dot}>{'•'}</Text>
        <Text style={styles.detailText}>
          {item.questions_asked} question{item.questions_asked !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.dot}>{'•'}</Text>
        <Text style={styles.detailText}>
          {item.interview_mode === 'live' ? 'Live Bot' : item.interview_mode === 'voice' ? 'Voice' : 'Text'}
        </Text>
        {duration && (
          <>
            <Text style={styles.dot}>{'•'}</Text>
            <Text style={styles.detailText}>{duration}</Text>
          </>
        )}
      </View>

      {dateStr !== '' && <Text style={styles.date}>{dateStr}</Text>}

      <View style={styles.cardFooter}>
        {item.overall_score != null ? (
          <View style={styles.scoreContainer}>
            <Text
              style={[styles.scoreValue, { color: getScoreColor(item.overall_score) }]}
            >
              {item.overall_score.toFixed(1)}
            </Text>
            <Text style={styles.scoreLabel}>Score</Text>
          </View>
        ) : actionLabel ? (
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        ) : null}
        <Text style={styles.chevron}>{'›'}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [interviews, setInterviews] = useState<InterviewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchInterviews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(false);

    try {
      const res = await getUserInterviews();
      setInterviews(res.interviews);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  const onRefresh = () => fetchInterviews(true);

  const [resuming, setResuming] = useState(false);

  const handleCardPress = useCallback(async (id: string) => {
    const item = interviews.find((i) => i.id === id);
    if (!item) return;

    if (item.status === 'completed') {
      navigation.navigate('Report', { interviewId: id });
      return;
    }

    if (item.status === 'configured') {
      navigation.navigate('InterviewLobby', {
        interviewId: id,
        mode: item.interview_mode,
      });
      return;
    }

    if (item.status === 'in_progress') {
      setResuming(true);
      try {
        const res = await resumeInterview(id);
        if (item.interview_mode === 'voice') {
          navigation.navigate('VoiceInterview', {
            interviewId: id,
            firstQuestion: res.question,
            progress: res.progress,
          });
        } else {
          navigation.navigate('Interview', {
            interviewId: id,
            mode: item.interview_mode,
            firstQuestion: res.question,
            progress: res.progress,
          });
        }
      } catch (err: any) {
        Alert.alert('Resume Error', err.message || 'Could not resume this interview.');
      } finally {
        setResuming(false);
      }
    }
  }, [interviews, navigation]);

  const renderItem = useCallback(({ item }: { item: InterviewHistoryItem }) => (
    <HistoryCard item={item} onPress={handleCardPress} />
  ), [handleCardPress]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ListSkeleton count={5} />
      </View>
    );
  }

  if (error && interviews.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Failed to load history</Text>
        <Text style={styles.errorDesc}>Check your connection and try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchInterviews(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (interviews.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No interviews yet</Text>
        <TouchableOpacity onPress={() => navigation.navigate('InterviewSetup')}>
          <Text style={styles.link}>Start your first interview</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {resuming && (
        <View style={styles.resumingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.resumingText}>Resuming interview...</Text>
        </View>
      )}
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={interviews}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.md },
  link: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    color: colors.error,
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  errorDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.md, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  dot: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scoreContainer: {
    alignItems: 'flex-start',
  },
  scoreValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: fontSize.xs,
    color: colors.textLight,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textLight,
    fontWeight: '300',
  },
  resumingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  resumingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
});
