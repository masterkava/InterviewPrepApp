import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, fontSize } from '../constants/theme';
import { startInterview } from '../services/api';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'InterviewLobby'>;
type Route = RouteProp<RootStackParamList, 'InterviewLobby'>;

export default function InterviewLobbyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { interviewId, mode } = route.params;
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      startInterview(interviewId)
        .then((res) => {
          if (mode === 'voice') {
            navigation.replace('VoiceInterview', {
              interviewId,
              firstQuestion: res.question,
              progress: res.progress,
            });
          } else {
            navigation.replace('Interview', {
              interviewId,
              mode,
              firstQuestion: res.question,
              progress: res.progress,
            });
          }
        })
        .catch(() => {
          navigation.goBack();
        });
    }
  }, [countdown, interviewId, mode, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Get Ready!</Text>
      <Text style={styles.subtitle}>
        Your {mode === 'voice' ? 'voice' : 'text'} interview starts in
      </Text>
      <Text style={styles.countdown}>{countdown}</Text>
      {countdown === 0 && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  countdown: {
    fontSize: 80,
    fontWeight: '700',
    color: colors.primary,
  },
});
