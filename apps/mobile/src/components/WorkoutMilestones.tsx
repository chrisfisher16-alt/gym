import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useWorkoutStore } from '../stores/workout-store';
import { Card } from './ui';

const WORKOUT_MILESTONES = [10, 25, 50, 100, 250] as const;

function getStreak(history: Array<{ completedAt: string }>): number {
  if (history.length === 0) return 0;

  // Get unique workout dates sorted descending
  const dates = Array.from(
    new Set(
      history.map((s) => new Date(s.completedAt).toISOString().split('T')[0]),
    ),
  ).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Streak must include today or yesterday
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.round(diffDays) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function WorkoutMilestones() {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const programCompletions = useWorkoutStore((s) => s.programCompletions);

  const totalWorkouts = history.length;
  const streak = useMemo(() => getStreak(history), [history]);
  const programsCompleted = Object.keys(programCompletions).length;

  // Next milestone
  const nextMilestone = WORKOUT_MILESTONES.find((m) => m > totalWorkouts) ?? null;
  const prevMilestone = [...WORKOUT_MILESTONES].reverse().find((m) => m <= totalWorkouts) ?? 0;

  return (
    <Card style={{ marginBottom: spacing.base }}>
      <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
        Milestones
      </Text>

      <View style={styles.statsRow}>
        {/* Streak */}
        <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
          <Ionicons
            name="flame"
            size={22}
            color={streak > 0 ? colors.warning : colors.textTertiary}
          />
          <Text style={[typography.h3, { color: colors.text, marginTop: 2 }]}>
            {streak}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Day Streak
          </Text>
        </View>

        {/* Total Workouts */}
        <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
          <Ionicons name="barbell" size={22} color={colors.primary} />
          <Text style={[typography.h3, { color: colors.text, marginTop: 2 }]}>
            {totalWorkouts}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Workouts
          </Text>
        </View>

        {/* Programs Completed */}
        <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
          <Ionicons name="trophy" size={22} color={colors.success} />
          <Text style={[typography.h3, { color: colors.text, marginTop: 2 }]}>
            {programsCompleted}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Programs
          </Text>
        </View>
      </View>

      {/* Milestone badges */}
      <View style={[styles.badgesRow, { marginTop: spacing.md }]}>
        {WORKOUT_MILESTONES.map((milestone) => {
          const achieved = totalWorkouts >= milestone;
          return (
            <View
              key={milestone}
              style={[
                styles.badge,
                {
                  backgroundColor: achieved ? colors.primaryMuted : colors.surfaceSecondary,
                  borderRadius: radius.full ?? 20,
                  borderWidth: achieved ? 1 : 0,
                  borderColor: achieved ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color: achieved ? colors.primary : colors.textTertiary,
                    fontWeight: achieved ? '700' : '400',
                  },
                ]}
              >
                {milestone}
              </Text>
            </View>
          );
        })}
      </View>

      {nextMilestone && (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          {nextMilestone - totalWorkouts} workout{nextMilestone - totalWorkouts !== 1 ? 's' : ''} to next milestone
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
