import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { getRoles, createInterview } from '../services/api';
import { SetupSkeleton } from '../components/SkeletonLoader';
import type { Role } from '../types/role';
import type { Difficulty, ExperienceLevel, InterviewMode } from '../types/interview';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewSetup'>;

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string }[] = [
  { value: 'fresher', label: 'Fresher' },
  { value: 'junior', label: 'Junior (1-2 yrs)' },
  { value: 'mid', label: 'Mid (3-5 yrs)' },
  { value: 'senior', label: 'Senior (5+ yrs)' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'adaptive', label: 'Adaptive' },
];

const MODES: { value: InterviewMode; label: string; desc: string }[] = [
  { value: 'text', label: 'Text', desc: 'Type your answers' },
  { value: 'voice', label: 'Voice', desc: 'Speak your answers' },
];

export default function InterviewSetupScreen() {
  const navigation = useNavigation<Nav>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedRole, setSelectedRole] = useState<string>('');
  const [experience, setExperience] = useState<ExperienceLevel>('fresher');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [mode, setMode] = useState<InterviewMode>('text');

  const loadRoles = () => {
    setLoading(true);
    setLoadError(false);
    getRoles()
      .then((res) => {
        setRoles(res.roles);
        if (res.roles.length > 0) setSelectedRole(res.roles[0].id);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleStart = async () => {
    if (!selectedRole) return;
    setCreating(true);
    try {
      const session = await createInterview({
        role_id: selectedRole,
        experience_level: experience,
        difficulty,
        duration_minutes: 15,
        interview_mode: mode,
      });
      navigation.navigate('InterviewLobby', { interviewId: session.id, mode });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create interview');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SetupSkeleton />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Failed to load roles</Text>
        <Text style={styles.errorDesc}>Check your connection and try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRoles}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Setup Your Interview</Text>

      {/* Role Selection */}
      <Text style={styles.label}>Select Role</Text>
      <View style={styles.chipRow}>
        {roles.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[styles.chip, selectedRole === role.id && styles.chipSelected]}
            onPress={() => setSelectedRole(role.id)}
          >
            <Text style={[styles.chipText, selectedRole === role.id && styles.chipTextSelected]}>
              {role.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Experience Level */}
      <Text style={styles.label}>Experience Level</Text>
      <View style={styles.chipRow}>
        {EXPERIENCE_LEVELS.map((lvl) => (
          <TouchableOpacity
            key={lvl.value}
            style={[styles.chip, experience === lvl.value && styles.chipSelected]}
            onPress={() => setExperience(lvl.value)}
          >
            <Text style={[styles.chipText, experience === lvl.value && styles.chipTextSelected]}>
              {lvl.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Difficulty */}
      <Text style={styles.label}>Difficulty</Text>
      <View style={styles.chipRow}>
        {DIFFICULTIES.map((d) => (
          <TouchableOpacity
            key={d.value}
            style={[styles.chip, difficulty === d.value && styles.chipSelected]}
            onPress={() => setDifficulty(d.value)}
          >
            <Text style={[styles.chipText, difficulty === d.value && styles.chipTextSelected]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interview Mode */}
      <Text style={styles.label}>Interview Mode</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            style={[styles.modeCard, mode === m.value && styles.modeCardSelected]}
            onPress={() => setMode(m.value)}
          >
            <Text style={[styles.modeTitle, mode === m.value && styles.modeTitleSelected]}>
              {m.label}
            </Text>
            <Text style={[styles.modeDesc, mode === m.value && styles.modeDescSelected]}>
              {m.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startButton, creating && styles.startButtonDisabled]}
        onPress={handleStart}
        disabled={creating || !selectedRole}
      >
        {creating ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.startButtonText}>Start Interview</Text>
        )}
      </TouchableOpacity>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    color: colors.error,
    fontSize: fontSize.xl,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    lineHeight: 48,
    marginBottom: spacing.md,
    overflow: 'hidden' as const,
  },
  errorTitle: { fontSize: fontSize.lg, fontWeight: '600' as const, color: colors.text, marginBottom: spacing.xs },
  errorDesc: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' as const, marginBottom: spacing.lg },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.md, fontWeight: '600' as const },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modeCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  modeTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modeTitleSelected: {
    color: colors.primary,
  },
  modeDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  modeDescSelected: {
    color: colors.primaryDark,
  },
  startButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
