import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { getReport } from '../services/api';
import type { ReportResponse } from '../types/interview';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Report'>;
type Route = RouteProp<RootStackParamList, 'Report'>;

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 10);
  const barColor = score >= 7 ? colors.success : score >= 5 ? colors.warning : colors.error;
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.scoreValue}>{score.toFixed(1)}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { interviewId } = route.params;
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport(interviewId)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Report not available yet.</Text>
        <TouchableOpacity onPress={() => navigation.popToTop()}>
          <Text style={styles.link}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overall Score */}
      <View style={styles.overallCard}>
        <Text style={styles.overallScore}>{report.overall_score.toFixed(1)}</Text>
        <Text style={styles.overallLabel}>/ 10</Text>
        <Text style={styles.readiness}>{report.readiness_level}</Text>
      </View>

      {/* Score Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Breakdown</Text>
        <ScoreBar label="Technical" score={report.technical_score} />
        <ScoreBar label="Communication" score={report.communication_score} />
        <ScoreBar label="Problem Solving" score={report.problem_solving_score} />
        <ScoreBar label="Confidence" score={report.confidence_score} />
      </View>

      {/* Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Summary</Text>
        <Text style={styles.bodyText}>{report.summary}</Text>
      </View>

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Strengths</Text>
          {report.strengths.map((s, i) => (
            <Text key={i} style={styles.listItem}>  {s}</Text>
          ))}
        </View>
      )}

      {/* Weaknesses */}
      {report.weaknesses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Areas to Improve</Text>
          {report.weaknesses.map((w, i) => (
            <Text key={i} style={styles.listItem}>  {w}</Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.homeButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  overallCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  overallScore: { fontSize: 56, fontWeight: '700', color: '#FFFFFF' },
  overallLabel: { fontSize: fontSize.lg, color: '#FFFFFF', opacity: 0.8, marginTop: -spacing.sm },
  readiness: { fontSize: fontSize.md, color: '#FFFFFF', marginTop: spacing.sm, textTransform: 'capitalize' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  bodyText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
  listItem: { fontSize: fontSize.sm, color: colors.text, marginBottom: spacing.xs, lineHeight: 20 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreLabel: { width: 110, fontSize: fontSize.sm, color: colors.text },
  scoreBarBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, marginHorizontal: spacing.sm },
  scoreBarFill: { height: 8, borderRadius: 4 },
  scoreValue: { width: 32, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },
  homeButton: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  homeButtonText: { color: colors.text, fontSize: fontSize.md, fontWeight: '500' },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.md },
  link: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
});
