import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { UserType } from '../types/auth';

const USER_TYPES: { value: UserType; label: string; desc: string }[] = [
  { value: 'student', label: 'Student', desc: 'Currently in college or studying' },
  { value: 'fresher', label: 'Fresher', desc: 'Graduated, less than 1 year experience' },
  { value: 'experienced', label: 'Experienced', desc: '1+ years of professional experience' },
];

export default function ProfileSetupScreen() {
  const { updateProfile, user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [userType, setUserType] = useState<UserType | null>(user?.user_type ?? null);
  const [targetRole, setTargetRole] = useState(user?.target_role ?? '');
  const [yearsExp, setYearsExp] = useState(
    user?.years_of_experience != null ? String(user.years_of_experience) : '',
  );
  const [loading, setLoading] = useState(false);

  const isValid =
    displayName.trim().length > 0 &&
    userType !== null &&
    targetRole.trim().length > 0 &&
    (userType !== 'experienced' || (yearsExp.length > 0 && Number(yearsExp) >= 1));

  async function handleSubmit() {
    if (!isValid || !userType) return;
    setLoading(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        user_type: userType,
        target_role: targetRole.trim(),
        years_of_experience: userType === 'experienced' ? Number(yearsExp) : undefined,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Help us personalize your experience</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor={colors.textLight}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          editable={!loading}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>I am a...</Text>
        <View style={styles.chipRow}>
          {USER_TYPES.map((ut) => (
            <TouchableOpacity
              key={ut.value}
              style={[styles.chip, userType === ut.value && styles.chipActive]}
              onPress={() => setUserType(ut.value)}
              disabled={loading}
            >
              <Text
                style={[styles.chipText, userType === ut.value && styles.chipTextActive]}
              >
                {ut.label}
              </Text>
              <Text
                style={[
                  styles.chipDesc,
                  userType === ut.value && styles.chipDescActive,
                ]}
              >
                {ut.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Target Role</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Backend Developer, Full Stack"
          placeholderTextColor={colors.textLight}
          value={targetRole}
          onChangeText={setTargetRole}
          editable={!loading}
        />
      </View>

      {userType === 'experienced' && (
        <View style={styles.field}>
          <Text style={styles.label}>Years of Experience</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 3"
            placeholderTextColor={colors.textLight}
            value={yearsExp}
            onChangeText={(t) => setYearsExp(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            editable={!loading}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Get Started'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.text,
  },
  chipRow: {
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  chipText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  chipDescActive: {
    color: colors.primaryDark,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
