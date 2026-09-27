import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

interface AudioPlayerProps {
  audioUrl: string;
  onFinished: () => void;
  autoPlay?: boolean;
}

export default function AudioPlayer({ audioUrl, onFinished, autoPlay = true }: AudioPlayerProps) {
  const [hasFinished, setHasFinished] = useState(false);
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (autoPlay && status.isLoaded && !status.playing && !hasFinished) {
      player.play();
    }
  }, [autoPlay, status.isLoaded, status.playing, hasFinished, player]);

  useEffect(() => {
    if (status.didJustFinish && !hasFinished) {
      setHasFinished(true);
      onFinished();
    }
  }, [status.didJustFinish, hasFinished, onFinished]);

  const progressPercent = status.duration > 0
    ? (status.currentTime / status.duration) * 100
    : 0;

  if (!status.isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.label}>Loading audio...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{status.playing ? '🔊' : '🔈'}</Text>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <Text style={styles.timeText}>
        {formatTime(status.currentTime)} / {formatTime(status.duration)}
      </Text>

      {!hasFinished && (
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => (status.playing ? player.pause() : player.play())}
        >
          <Text style={styles.controlText}>{status.playing ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
      )}

      {hasFinished && (
        <Text style={styles.doneText}>Playback complete</Text>
      )}
    </View>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#EEF2FF',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  controlBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  doneText: {
    fontSize: fontSize.sm,
    color: colors.success,
    fontWeight: '500',
  },
});
