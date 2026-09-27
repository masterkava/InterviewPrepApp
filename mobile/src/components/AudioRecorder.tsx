import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.isFinished && status.url) {
      setIsRecording(false);
      clearTimer();
      onRecordingComplete(status.url);
    }
  });

  useEffect(() => {
    (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      setHasPermission(granted);
    })();
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const startRecording = async () => {
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Recording Error', err.message || 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      clearTimer();
      setIsRecording(false);
      await recorder.stop();
    } catch (err: any) {
      Alert.alert('Recording Error', err.message || 'Could not stop recording.');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Checking microphone permission...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🚫</Text>
        </View>
        <Text style={styles.label}>Microphone permission denied</Text>
        <Text style={styles.hint}>Please grant microphone access in your device settings.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordButtonActive,
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={disabled}
      >
        <View style={[styles.recordDot, isRecording && styles.recordDotActive]} />
      </TouchableOpacity>

      <Text style={styles.label}>
        {isRecording ? formatTime(duration) : 'Tap to record'}
      </Text>

      {isRecording && (
        <Text style={styles.hint}>Tap again to stop recording</Text>
      )}

      {!isRecording && (
        <Text style={styles.hint}>Record your answer using the microphone</Text>
      )}
    </View>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  recordButtonActive: {
    borderColor: colors.error,
    backgroundColor: '#FEE2E2',
  },
  recordDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
  },
  recordDotActive: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
});
