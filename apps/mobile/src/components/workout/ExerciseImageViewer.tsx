import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '../../theme';
import { getExerciseImages } from '../../lib/exercise-image-map';
import { ExerciseFallbackIcon } from './ExerciseFallbackIcon';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseImageViewerProps {
  exerciseId: string;
  size: 'compact' | 'focused' | 'detail';
  isResting?: boolean;
  style?: ViewStyle;
}

// ── Constants ────────────────────────────────────────────────────────

const SIZE_HEIGHTS: Record<ExerciseImageViewerProps['size'], number> = {
  compact: 140,
  focused: 140,
  detail: 280,
};

const DEFAULT_CYCLE_MS = 2500;
const RESTING_CYCLE_MS = 1500;
const RESUME_DELAY_MS = 5000;
const SWIPE_THRESHOLD = 30;

// Module-level pulse tracker — once per app session
let hasShownPulse = false;

// ── Component ────────────────────────────────────────────────────────

export function ExerciseImageViewer({
  exerciseId,
  size,
  isResting,
  style,
}: ExerciseImageViewerProps) {
  const { colors, radius } = useTheme();
  const images = useMemo(() => getExerciseImages(exerciseId), [exerciseId]);

  const [showEnd, setShowEnd] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);

  // ── Animated values ──────────────────────────────────────────────
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  const labelPulseAnim = useRef(new Animated.Value(1)).current;

  // ── Reset state when exerciseId changes ──────────────────────────
  useEffect(() => {
    setShowEnd(false);
    setLoadError(false);
    setLoaded(false);
  }, [exerciseId]);

  // ── Skeleton shimmer ─────────────────────────────────────────────
  useEffect(() => {
    if (loaded || loadError) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [loaded, loadError, skeletonAnim]);

  const skeletonOpacity = skeletonAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  // ── Teaching pulse (first view per session) ──────────────────────
  useEffect(() => {
    if (hasShownPulse || !loaded) return;
    hasShownPulse = true;
    Animated.sequence([
      Animated.timing(labelPulseAnim, { toValue: 1.8, duration: 400, useNativeDriver: true }),
      Animated.timing(labelPulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [loaded, labelPulseAnim]);

  // ── Toggle logic ─────────────────────────────────────────────────
  const toggle = useCallback(() => {
    setShowEnd((prev) => !prev);
  }, []);

  // ── Auto-cycle ───────────────────────────────────────────────────
  const cycleMs = isResting === true ? RESTING_CYCLE_MS : DEFAULT_CYCLE_MS;

  const startAutoCycle = useCallback(() => {
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    autoCycleRef.current = setInterval(() => {
      setShowEnd((prev) => !prev);
    }, cycleMs);
  }, [cycleMs]);

  const stopAutoCycle = useCallback(() => {
    if (autoCycleRef.current) {
      clearInterval(autoCycleRef.current);
      autoCycleRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!loaded || loadError || !images) return;
    startAutoCycle();
    return () => {
      stopAutoCycle();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [loaded, loadError, images, startAutoCycle, stopAutoCycle]);

  const pauseAndScheduleResume = useCallback(() => {
    isPausedRef.current = true;
    stopAutoCycle();
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isPausedRef.current = false;
      startAutoCycle();
    }, RESUME_DELAY_MS);
  }, [stopAutoCycle, startAutoCycle]);

  // ── Tap handler ──────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    toggle();
    pauseAndScheduleResume();
  }, [toggle, pauseAndScheduleResume]);

  // ── PanResponder for swipe ───────────────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e: GestureResponderEvent, gs: PanResponderGestureState) =>
          Math.abs(gs.dx) > 10,
        onPanResponderRelease: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
          if (Math.abs(gs.dx) >= SWIPE_THRESHOLD) {
            // Swipe detected — toggle
            toggle();
            pauseAndScheduleResume();
          } else if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
            // Tap (minimal movement)
            handleTap();
          }
        },
      }),
    [toggle, pauseAndScheduleResume, handleTap],
  );

  // ── Derived values ───────────────────────────────────────────────
  const height = SIZE_HEIGHTS[size];
  const label = showEnd ? 'End' : 'Start';
  const imageUri = images
    ? showEnd
      ? images.endPosition
      : images.startPosition
    : undefined;

  const containerStyle: ViewStyle = {
    width: '100%' as unknown as number,
    height,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  };

  // ── No images available ──────────────────────────────────────────
  if (!images) {
    return (
      <View style={[containerStyle, style]}>
        <ExerciseFallbackIcon exerciseId={exerciseId} size={size} />
      </View>
    );
  }

  // ── Error fallback ───────────────────────────────────────────────
  if (loadError) {
    return (
      <View style={[containerStyle, style]}>
        <ExerciseFallbackIcon exerciseId={exerciseId} size={size} />
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]} {...panResponder.panHandlers}>
      {/* Skeleton placeholder (visible until loaded) */}
      {!loaded && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.surfaceSecondary, opacity: skeletonOpacity },
          ]}
        />
      )}

      {/* Exercise image */}
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        transition={200}
        onLoad={() => setLoaded(true)}
        onError={() => setLoadError(true)}
      />

      {/* Position label overlay */}
      {loaded && (
        <Animated.View style={[styles.labelContainer, { opacity: labelPulseAnim }]}>
          <Text style={styles.labelText}>{label}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  labelContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
