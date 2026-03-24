import React from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../theme';
import {
  EXERCISE_ILLUSTRATIONS,
  CATEGORY_COLORS,
  CATEGORY_COLORS_DARK,
} from '../../lib/exercise-illustrations';
import type { MuscleGroup } from '../../types/workout';

// ── Constants ────────────────────────────────────────────────────────

/** Warm gray/gold blurhash that matches the Carbon design palette. */
export const DEFAULT_EXERCISE_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const THUMBNAIL_SIZE = 60;
const HERO_HEIGHT = 200;
const TRANSITION_MS = 200;

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseImageProps {
  exerciseId: string;
  variant: 'thumbnail' | 'hero';
  /** Direct image URL — highest priority in the fallback chain. */
  imageUrl?: string;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Primary muscle group for placeholder color. */
  category?: MuscleGroup;
}

// ── Component ────────────────────────────────────────────────────────

export function ExerciseImage({
  exerciseId,
  variant,
  imageUrl,
  width,
  height,
  style,
  onPress,
  category,
}: ExerciseImageProps) {
  const { dark, colors, radius: themeRadius } = useTheme();

  const resolvedUrl = imageUrl ?? undefined; // Step 2 of fallback: could look up media store in the future

  const isThumbnail = variant === 'thumbnail';
  const containerWidth = width ?? (isThumbnail ? THUMBNAIL_SIZE : undefined);
  const containerHeight = height ?? (isThumbnail ? THUMBNAIL_SIZE : HERO_HEIGHT);

  const borderRadiusStyle: ViewStyle = isThumbnail
    ? { borderRadius: themeRadius.md }
    : {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: themeRadius.lg,
        borderBottomRightRadius: themeRadius.lg,
      };

  const containerStyle: ViewStyle = {
    width: containerWidth,
    height: containerHeight,
    overflow: 'hidden',
    ...borderRadiusStyle,
  };

  const content = resolvedUrl ? (
    <Image
      source={{ uri: resolvedUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      placeholder={{ blurhash: DEFAULT_EXERCISE_BLURHASH }}
      transition={TRANSITION_MS}
      cachePolicy="memory-disk"
    />
  ) : (
    <GradientPlaceholder
      exerciseId={exerciseId}
      category={category}
      isThumbnail={isThumbnail}
    />
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[containerStyle, style]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{content}</View>;
}

// ── Gradient Placeholder ─────────────────────────────────────────────

function GradientPlaceholder({
  exerciseId,
  category,
  isThumbnail,
}: {
  exerciseId: string;
  category?: MuscleGroup;
  isThumbnail: boolean;
}) {
  const { dark, colors } = useTheme();
  const illustration = EXERCISE_ILLUSTRATIONS[exerciseId];
  const iconName = illustration?.equipmentIcon ?? 'barbell-outline';
  const iconSize = isThumbnail ? 24 : 40;

  const palette = category
    ? dark
      ? CATEGORY_COLORS_DARK[category]
      : CATEGORY_COLORS[category]
    : undefined;

  const baseColor = palette?.bg ?? colors.surface;
  const iconColor = palette?.text ?? colors.textSecondary;

  return (
    <LinearGradient
      colors={[baseColor, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.placeholder]}
    >
      <Ionicons name={iconName as any} size={iconSize} color={iconColor} />
    </LinearGradient>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
