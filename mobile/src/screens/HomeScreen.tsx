import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { getHealth } from '../services/api';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    getHealth()
      .then(() => setServerStatus('online'))
      .catch(() => setServerStatus('offline'));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Interview Prep</Text>
        <Text style={styles.subtitle}>
          AI-powered mock interviews to help you ace your next technical interview
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: serverStatus === 'online' ? colors.success : serverStatus === 'offline' ? colors.error : colors.warning },
          ]}
        />
        <Text style={styles.statusText}>
          Server: {serverStatus === 'checking' ? 'Checking...' : serverStatus}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.navigate('InterviewSetup')}
          disabled={serverStatus !== 'online'}
        >
          <Text style={styles.primaryButtonText}>Start Interview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Question Bank' })}
        >
          <Text style={styles.secondaryButtonText}>Browse Questions</Text>
        </TouchableOpacity>
      </View>

      {serverStatus === 'checking' && (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
      )}

      {serverStatus === 'offline' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Cannot connect to server. Make sure the backend is running.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setServerStatus('checking');
              getHealth()
                .then(() => setServerStatus('online'))
                .catch(() => setServerStatus('offline'));
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  errorBox: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
