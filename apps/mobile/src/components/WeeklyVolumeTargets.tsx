import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { useWorkoutStore } from '../stores/workout-store';
import type { CompletedSession } from '../types/workout';
import { Card } from './ui';

// ── Types ────────────────────────────────────────────────────────────

export interface WeeklyVolumeTargetsProps {
  history: CompletedSession[];
  goal?: string; // 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'
  style?: StyleProp<ViewStyle>;
}

// ── Volume Targets ──────────────────────────────────────────────────

const VOLUME_TARGETS: Record<string, Record<string, { min: number; max: number }>> = {
  hypertrophy: {
    chest: { min: 10, max: 20 },
    back: { min: 10, max: 20 },
    shoulders: { min: 8, max: 16 },
    legs: { min: 10, max: 20 },
    arms: { min: 6, max: 14 },
    core: { min: 4, max: 10 },
  },
  strength: {
    chest: { min: 6, max: 12 },
    back: { min: 6, max: 12 },
    shoulders: { min: 4, max: 10 },
    legs: { min: 6, max: 15 },
    arms: { min: 4, max: 8 },
    core: { min: 2, max: 6 },
  },
  endurance: {
    chest: { min: 8, max: 16 },
    back: { min: 8, max: 16 },
    shoulders: { min: 6, max: 12 },
    legs: { min: 8, max: 16 },
    arms: { min: 6, max: 12 },
    core: { min: 4, max: 8 },
  },
  general_fitness: {
    chest: { min: 8, max: 16 },
    back: { min: 8, max: 16 },
    shoulders: { min: 6, max: 12 },
    legs: { min: 8, max: 16 },
    arms: { min: 6, max: 12 },
    core: { min: 4, max: 8 },
  },
};

const DISPLAY_GROUPS: { key: string; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'legs', label: 'Legs' },
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
];

// Map primaryGoal from profile store to volume target key
function mapGoalToTargetKey(goal?: string): string {
  if (!goal) return 'general_fitness';
  switch (goal) {
    case 'gain_muscle':
    case 'build_lean_muscle':
      return 'hypertrophy';
    case 'lose_weight':
    case 'maintain_weight':
    case 'improve_general_health':
      return 'general_fitness';
    case 'improve_endurance':
      return 'endurance';
    // Direct matches
    case 'strength':
    case 'hypertrophy':
    case 'endurance':
    case 'general_fitness':
      return goal;
    default:
      return 'general_fitness';
  }
}

// Map exercise categories to volume target groups
function categoryToGroups(category: string): string[] {
  switch (category) {
    case 'chest':
      return ['chest'];
    case 'back':
      return ['back'];
    case 'shoulders':
      return ['shoulders'];
    case 'legs':
      return ['legs'];
    case 'arms':
      return ['arms'];
    case 'core':
      return ['core'];
    case 'full_body':
      return ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
    default:
      return [];
  }
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// ── Component ───────────────────────────────────────────────────────

export function WeeklyVolumeTargets({ history, goal, style }: WeeklyVolumeTargetsProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const exercises = useWorkoutStore((s) => s.exercises);

  const targetKey = mapGoalToTargetKey(goal);
  const targets = VOLUME_TARGETS[targetKey] ?? VOLUME_TARGETS.general_fitness;

  const weekSets = useMemo(() => {
    const { start, end } = getWeekBounds();
    const counts: Record<string, number> = {
      chest: 0,
      back: 0,
      shoulders: 0,
      legs: 0,
      arms: 0,
      core: 0,
    };

    for (const session of history) {
      const completedDate = new Date(session.completedAt);
      if (completedDate < start || completedDate > end) continue;

      for (const ex of session.exercises) {
        const lib = exercises.find((e) => e.id === ex.exerciseId);
        const groups = lib ? categoryToGroups(lib.category) : [];
        for (const group of groups) {
          if (group in counts) {
            counts[group] += ex.sets.length;
          }
        }
      }
    }

    return counts;
  }, [history, exercises]);

  return (
    <Card style={style}>
      {DISPLAY_GROUPS.map((group) => {
        const actual = weekSets[group.key] ?? 0;
        const target = targets[group.key];
        const maxTarget = target?.max ?? 16;
        const minTarget = target?.min ?? 8;
        const barMax = Math.max(maxTarget, actual);
        const fillPct = barMax > 0 ? Math.min((actual / barMax) * 100, 100) : 0;

        // Determine fill color
        let fillColor: string;
        if (actual > maxTarget) {
          fillColor = colors.error; // Over-training (red)
        } else if (actual >= minTarget) {
          fillColor = colors.completed; // On track (green)
        } else if (actual > 0) {
          fillColor = colors.warning; // Under-training (yellow)
        } else {
          fillColor = colors.textTertiary; // No sets
        }

        return (
          <View key={group.key} style={{ marginBottom: spacing.sm }}>
            <View style={styles.rowLabel}>
              <Text
                style={[typography.label, { color: colors.text, width: 80 }]}
                numberOfLines={1}
              >
                {group.label}
              </Text>
              <View style={[styles.barBg, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, flex: 1, marginHorizontal: spacing.sm }]}>
                <View
                  style={{
                    height: 8,
                    width: `${fillPct}%`,
                    backgroundColor: fillColor,
                    borderRadius: radius.sm,
                  }}
                />
              </View>
              <Text
                style={[typography.bodySmall, { color: colors.textSecondary, width: 65, textAlign: 'right' }]}
              >
                {actual}/{maxTarget} sets
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
        Targets based on {targetKey.replace('_', ' ')} goal
      </Text>
    </Card>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBg: {
    height: 8,
    overflow: 'hidden',
  },
});
