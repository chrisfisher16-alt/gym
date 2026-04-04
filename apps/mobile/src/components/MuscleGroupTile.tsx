import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';
import type { MuscleHighlight } from './MuscleAnatomyDiagram';
import type { MuscleId } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface MuscleGroupInfo {
  id: string;
  label: string;
  muscleIds: MuscleId[];
  category: 'main' | 'accessory';
}

export interface MuscleGroupTileProps {
  muscleGroup: MuscleGroupInfo;
  selected: boolean;
  onPress: () => void;
  recoveryPercent?: number; // 0-100
  size?: number; // Default ~100
}

// ── Muscle Groups Constant ───────────────────────────────────────────

export const MUSCLE_GROUPS: MuscleGroupInfo[] = [
  // Main
  { id: 'abs', label: 'Abs', muscleIds: ['rectus_abdominis', 'obliques', 'transverse_abdominis'], category: 'main' },
  { id: 'back', label: 'Back', muscleIds: ['latissimus_dorsi', 'rhomboids', 'trapezius'], category: 'main' },
  { id: 'biceps', label: 'Biceps', muscleIds: ['biceps'], category: 'main' },
  { id: 'chest', label: 'Chest', muscleIds: ['pectoralis_major', 'pectoralis_minor'], category: 'main' },
  { id: 'glutes', label: 'Glutes', muscleIds: ['glutes'], category: 'main' },
  { id: 'hamstrings', label: 'Hamstrings', muscleIds: ['hamstrings'], category: 'main' },
  { id: 'quadriceps', label: 'Quadriceps', muscleIds: ['quadriceps'], category: 'main' },
  { id: 'shoulders', label: 'Shoulders', muscleIds: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'], category: 'main' },
  { id: 'triceps', label: 'Triceps', muscleIds: ['triceps'], category: 'main' },
  // Accessory
  { id: 'lower_back', label: 'Lower Back', muscleIds: ['erector_spinae'], category: 'accessory' },
  { id: 'calves', label: 'Calves', muscleIds: ['gastrocnemius', 'soleus'], category: 'accessory' },
  { id: 'forearms', label: 'Forearms', muscleIds: ['forearms'], category: 'accessory' },
  { id: 'hip_flexors', label: 'Hip Flexors', muscleIds: ['hip_flexors', 'adductors'], category: 'accessory' },
];

// ── Helpers ──────────────────────────────────────────────────────────

/** Muscles that appear on the front of the body */
const FRONT_MUSCLES: Set<MuscleId> = new Set([
  'pectoralis_major', 'pectoralis_minor',
  'deltoid_anterior', 'deltoid_lateral',
  'biceps', 'brachialis',
  'rectus_abdominis', 'obliques', 'transverse_abdominis',
  'quadriceps',
  'hip_flexors', 'adductors', 'abductors',
  'tibialis_anterior',
  'forearms',
]);

function detectView(muscleIds: MuscleId[]): 'front' | 'back' {
  let frontCount = 0;
  let backCount = 0;
  for (const id of muscleIds) {
    if (FRONT_MUSCLES.has(id)) frontCount++;
    else backCount++;
  }
  return frontCount >= backCount ? 'front' : 'back';
}

function getRecoveryColor(percent: number, colors: { success: string; warning: string; error: string }): string {
  if (percent >= 80) return colors.success;
  if (percent >= 50) return colors.warning;
  return colors.error;
}

// ── Component ────────────────────────────────────────────────────────

export function MuscleGroupTile({
  muscleGroup,
  selected,
  onPress,
  recoveryPercent,
  size = 100,
}: MuscleGroupTileProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const view = useMemo(() => detectView(muscleGroup.muscleIds), [muscleGroup.muscleIds]);

  const highlights: MuscleHighlight[] = useMemo(
    () => muscleGroup.muscleIds.map((muscleId) => ({
      muscleId,
      state: 'targeted' as const,
      opacity: 1,
    })),
    [muscleGroup.muscleIds],
  );

  // Fix 1: Maintain 1:2 aspect ratio matching viewBox="0 0 200 400"
  const diagramWidth = size * 0.5;
  const diagramHeight = size * 0.85;

  // Tile height: taller than width to accommodate portrait diagram + labels
  const tileHeight = size * 1.2;

  // Fix 3: Selection animation
  const highlightAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(highlightAnim, {
      toValue: selected ? 1 : 0,
      duration: selected ? 200 : 150,
      useNativeDriver: true,
    }).start();
  }, [selected, highlightAnim]);

  const animatedScale = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.0],
  });

  const animatedOpacity = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.0],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: animatedScale }],
        opacity: animatedOpacity,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.container,
          {
            width: size,
            height: tileHeight,
            backgroundColor: selected
              ? colors.primaryMuted
              : colors.surfaceSecondary,
            borderRadius: radius.md,
            borderWidth: selected ? 1.5 : 1,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        {/* Anatomy diagram — vertically centered in available space above label */}
        <View style={[styles.diagramWrap, { flex: 1 }]}>
          <MuscleAnatomyDiagram
            view={view}
            highlights={highlights}
            variant="mini"
            width={diagramWidth}
            height={diagramHeight}
            colorMode="brand"
          />
        </View>

        {/* Recovery badge */}
        {recoveryPercent != null && (
          <Text
            style={[
              typography.micro,
              {
                color: getRecoveryColor(recoveryPercent, colors),
                textAlign: 'center',
                marginTop: 2,
              },
            ]}
          >
            {Math.round(recoveryPercent)}%
          </Text>
        )}

        {/* Label */}
        <Text
          numberOfLines={1}
          style={[
            typography.labelSmall,
            {
              color: selected ? colors.primary : colors.text,
              textAlign: 'center',
              marginTop: spacing.xs,
              paddingBottom: spacing.xs,
            },
          ]}
        >
          {muscleGroup.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  diagramWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
