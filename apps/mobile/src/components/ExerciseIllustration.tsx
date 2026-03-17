import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import type { MuscleGroup, Equipment } from '../types/workout';
import {
  CATEGORY_COLORS,
  CATEGORY_COLORS_DARK,
  EQUIPMENT_ILLUSTRATION_ICONS,
  getExerciseIllustration,
  getMuscleColor,
  type MovementType,
} from '../lib/exercise-illustrations';

// ── Types ───────────────────────────────────────────────────────────

export type IllustrationSize = 'small' | 'medium' | 'large';

interface ExerciseIllustrationProps {
  exerciseId: string;
  category: MuscleGroup;
  equipment: Equipment;
  primaryMuscles?: string[];
  size?: IllustrationSize;
  style?: object;
}

// ── Size Config ─────────────────────────────────────────────────────

const SIZE_CONFIG = {
  small: { container: 40, icon: 20, showMuscles: false, showLabel: false },
  medium: { container: 60, icon: 28, showMuscles: true, showLabel: false },
  large: { container: 120, icon: 48, showMuscles: true, showLabel: true },
} as const;

const MOVEMENT_LABELS: Record<MovementType, string> = {
  push: 'Push',
  pull: 'Pull',
  squat: 'Squat',
  hinge: 'Hinge',
  carry: 'Carry',
  rotation: 'Rotation',
  isometric: 'Isometric',
};

// ── Component ───────────────────────────────────────────────────────

export function ExerciseIllustration({
  exerciseId,
  category,
  equipment,
  primaryMuscles,
  size = 'medium',
  style,
}: ExerciseIllustrationProps) {
  const { dark } = useTheme();
  const config = SIZE_CONFIG[size];
  const colorMap = dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
  const colors = colorMap[category] ?? colorMap.full_body;

  const illustration = getExerciseIllustration(exerciseId, category, equipment, primaryMuscles);
  const iconName = (illustration.equipmentIcon ?? EQUIPMENT_ILLUSTRATION_ICONS[equipment] ?? 'barbell-outline') as keyof typeof Ionicons.glyphMap;

  const borderRadius = size === 'small' ? config.container / 2 : config.container * 0.2;

  return (
    <View
      style={[
        styles.container,
        {
          width: config.container,
          height: config.container,
          borderRadius,
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      {/* Equipment icon */}
      <Ionicons name={iconName} size={config.icon} color={colors.text} />

      {/* Muscle group dots (medium + large) */}
      {config.showMuscles && illustration.muscleGroups.length > 0 && (
        <View style={styles.muscleDotsRow}>
          {illustration.muscleGroups.slice(0, size === 'large' ? 4 : 3).map((muscle, i) => (
            <View
              key={muscle}
              style={[
                styles.muscleDot,
                {
                  backgroundColor: getMuscleColor(muscle),
                  width: size === 'large' ? 8 : 5,
                  height: size === 'large' ? 8 : 5,
                  borderRadius: size === 'large' ? 4 : 2.5,
                  marginHorizontal: 1,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Movement type label (large only) */}
      {config.showLabel && (
        <Text style={[styles.label, { color: colors.text }]}>
          {MOVEMENT_LABELS[illustration.movementType]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  muscleDotsRow: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
  },
  muscleDot: {},
  label: {
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    bottom: 14,
    letterSpacing: 0.5,
  },
});
