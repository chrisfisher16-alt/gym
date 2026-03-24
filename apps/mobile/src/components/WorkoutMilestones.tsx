import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useWorkoutStore } from '../stores/workout-store';
import { ExpandableCard, ProgressBar, AnimatedNumber } from './ui';

const WORKOUT_MILESTONES = [10, 25, 50, 100, 250] as const;

function getStreak(history: Array<{ completedAt: string }>): number {
  if (history.length === 0) return 0;

  const dates = Array.from(
    new Set(
      history.map((s) => new Date(s.completedAt).toISOString().split('T')[0]),
    ),
  ).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

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

/** Get milestones the user has passed, sorted newest first */
function getAchievedMilestones(
  totalWorkouts: number,
  history: Array<{ completedAt: string }>,
): Array<{ milestone: number; achievedAt: string }> {
  const achieved: Array<{ milestone: number; achievedAt: string }> = [];

  for (const milestone of WORKOUT_MILESTONES) {
    if (totalWorkouts >= milestone) {
      // Approximate the date they hit this milestone
      const sortedAsc = [...history].sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      );
      const session = sortedAsc[milestone - 1];
      achieved.push({
        milestone,
        achievedAt: session ? session.completedAt : sortedAsc[sortedAsc.length - 1]?.completedAt ?? new Date().toISOString(),
      });
    }
  }

  return achieved.reverse();
}

export function WorkoutMilestones() {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const programCompletions = useWorkoutStore((s) => s.programCompletions);

  const totalWorkouts = history.length;
  const streak = useMemo(() => getStreak(history), [history]);
  const programsCompleted = Object.keys(programCompletions).length;

  const nextMilestone = WORKOUT_MILESTONES.find((m) => m > totalWorkouts) ?? null;
  const prevMilestone = [...WORKOUT_MILESTONES].reverse().find((m) => m <= totalWorkouts) ?? 0;
  const milestoneProgress = nextMilestone
    ? (totalWorkouts - prevMilestone) / (nextMilestone - prevMilestone)
    : 1;

  const achievedMilestones = useMemo(
    () => getAchievedMilestones(totalWorkouts, history),
    [totalWorkouts, history],
  );

  // Celebration animation when a milestone is freshly achieved
  const justAchieved = useMemo(() => {
    if (WORKOUT_MILESTONES.includes(totalWorkouts as (typeof WORKOUT_MILESTONES)[number])) {
      return totalWorkouts;
    }
    return null;
  }, [totalWorkouts]);

  const celebrationScale = useSharedValue(1);
  const prevTotal = useRef(totalWorkouts);

  useEffect(() => {
    if (justAchieved && totalWorkouts !== prevTotal.current) {
      celebrationScale.value = withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(0.95, { duration: 150 }),
        withTiming(1.0, { duration: 150 }),
      );
    }
    prevTotal.current = totalWorkouts;
  }, [justAchieved, totalWorkouts, celebrationScale]);

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  // ── Collapsed: icon + animated numbers ────────────────────────

  const collapsed = (
    <View style={styles.statsRow}>
      <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
        <Ionicons
          name="flame"
          size={22}
          color={streak > 0 ? colors.warning : colors.textTertiary}
        />
        <AnimatedNumber
          value={streak}
          style={[typography.h3, { color: colors.text, marginTop: 2 }]}
        />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Day Streak
        </Text>
      </View>

      <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
        <Ionicons name="barbell" size={22} color={colors.primary} />
        <AnimatedNumber
          value={totalWorkouts}
          style={[typography.h3, { color: colors.text, marginTop: 2 }]}
        />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Workouts
        </Text>
      </View>

      <View style={[styles.statItem, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
        <Ionicons name="trophy" size={22} color={colors.success} />
        <AnimatedNumber
          value={programsCompleted}
          style={[typography.h3, { color: colors.text, marginTop: 2 }]}
        />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Programs
        </Text>
      </View>
    </View>
  );

  // ── Expanded: progress to next milestone + timeline ───────────

  const expanded = (
    <View>
      {/* Progress to next milestone */}
      {nextMilestone ? (
        <View style={{ marginBottom: spacing.md }}>
          <View style={[styles.milestoneHeader, { marginBottom: spacing.sm }]}>
            <Text style={[typography.label, { color: colors.text }]}>
              Next Milestone
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {totalWorkouts}/{nextMilestone} workouts
            </Text>
          </View>
          <ProgressBar progress={milestoneProgress} height={8} />
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
            {nextMilestone - totalWorkouts} workout{nextMilestone - totalWorkouts !== 1 ? 's' : ''} to go
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.label, { color: colors.gold }]}>
            All milestones achieved!
          </Text>
        </View>
      )}

      {/* Milestone timeline */}
      {achievedMilestones.length > 0 && (
        <View>
          <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
            Achievement Timeline
          </Text>
          {achievedMilestones.map((item, idx) => {
            const date = new Date(item.achievedAt);
            const dateStr = date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            });

            return (
              <View
                key={item.milestone}
                style={[
                  styles.timelineItem,
                  { borderLeftColor: colors.primary },
                  idx === achievedMilestones.length - 1 && { borderLeftColor: 'transparent' },
                ]}
              >
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={styles.timelineContent}>
                  <Text style={[typography.label, { color: colors.text }]}>
                    {item.milestone} Workouts
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {dateStr}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Milestone badges */}
      <ReAnimated.View style={[styles.badgesRow, { marginTop: spacing.md }, justAchieved ? celebrationStyle : undefined]}>
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
      </ReAnimated.View>
    </View>
  );

  return (
    <ExpandableCard
      style={{ marginBottom: spacing.base }}
      expandedContent={expanded}
    >
      <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
        Milestones
      </Text>
      {collapsed}
    </ExpandableCard>
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
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 2,
    paddingLeft: 16,
    paddingBottom: 12,
    marginLeft: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    left: -6,
    top: 4,
  },
  timelineContent: {
    flex: 1,
  },
});
