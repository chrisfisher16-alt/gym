import React, { useMemo } from 'react';
import { Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme';
import { EXERCISE_LIBRARY } from '../../lib/exercise-data';
import {
  getExerciseIllustration,
  CATEGORY_COLORS,
  CATEGORY_COLORS_DARK,
} from '../../lib/exercise-illustrations';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseFallbackIconProps {
  exerciseId: string;
  size: 'compact' | 'focused' | 'detail';
  style?: StyleProp<ViewStyle>;
}

// ── Size Config ──────────────────────────────────────────────────────

const SIZE_CONFIG = {
  compact: { height: 160, emojiSize: 28, iconSize: 16 },
  focused: { height: 200, emojiSize: 36, iconSize: 18 },
  detail: { height: 280, emojiSize: 48, iconSize: 20 },
} as const;

// ── Component ────────────────────────────────────────────────────────

export function ExerciseFallbackIcon({
  exerciseId,
  size,
  style,
}: ExerciseFallbackIconProps) {
  const { dark, colors, radius } = useTheme();
  const config = SIZE_CONFIG[size];

  const { illustration, categoryPalette } = useMemo(() => {
    const entry = EXERCISE_LIBRARY.find((e) => e.id === exerciseId);
    const cat = entry?.category;
    const ill = getExerciseIllustration(
      exerciseId,
      cat,
      entry?.equipment,
      entry?.primaryMuscles,
    );
    const palette = cat
      ? dark
        ? CATEGORY_COLORS_DARK[cat]
        : CATEGORY_COLORS[cat]
      : undefined;
    return { illustration: ill, categoryPalette: palette };
  }, [exerciseId, dark]);

  const baseColor = categoryPalette?.bg ?? colors.surface;
  const iconColor = categoryPalette?.text ?? colors.textSecondary;

  return (
    <LinearGradient
      colors={[baseColor, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        { height: config.height, borderRadius: radius.lg },
        style as any,
      ]}
    >
      <Text style={[styles.emoji, { fontSize: config.emojiSize }]}>
        {illustration.emoji}
      </Text>
      <Ionicons
        name={illustration.equipmentIcon as any}
        size={config.iconSize}
        color={iconColor}
        style={styles.icon}
      />
    </LinearGradient>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    textAlign: 'center',
  },
  icon: {
    marginTop: 6,
  },
});
