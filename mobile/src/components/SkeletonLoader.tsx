import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width = '100%', height = 16, borderRadius: br = borderRadius.sm, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: br,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox width={120} height={14} />
        <SkeletonBox width={60} height={20} borderRadius={borderRadius.full} />
      </View>
      <SkeletonBox height={14} style={{ marginTop: spacing.sm }} />
      <SkeletonBox width="70%" height={14} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export function SetupSkeleton() {
  return (
    <View style={styles.setup}>
      <SkeletonBox width={200} height={24} style={{ marginBottom: spacing.lg }} />
      <SkeletonBox width={100} height={16} style={{ marginBottom: spacing.sm }} />
      <View style={styles.chipRow}>
        <SkeletonBox width={80} height={36} borderRadius={borderRadius.full} />
        <SkeletonBox width={100} height={36} borderRadius={borderRadius.full} />
        <SkeletonBox width={90} height={36} borderRadius={borderRadius.full} />
      </View>
      <SkeletonBox width={120} height={16} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />
      <View style={styles.chipRow}>
        <SkeletonBox width={70} height={36} borderRadius={borderRadius.full} />
        <SkeletonBox width={110} height={36} borderRadius={borderRadius.full} />
        <SkeletonBox width={90} height={36} borderRadius={borderRadius.full} />
        <SkeletonBox width={100} height={36} borderRadius={borderRadius.full} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
  },
  setup: {
    padding: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

export default SkeletonBox;
