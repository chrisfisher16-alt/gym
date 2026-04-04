import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useWorkoutStore } from '../../stores/workout-store';
import type { WorkoutProgramLocal } from '../../types/workout';
import { getDateString } from '../../lib/nutrition-utils';

// ── Types ──────────────────────────────────────────────────────────

type DayState = 'completed' | 'today' | 'upcoming' | 'rest' | 'past';

interface DayInfo {
  label: string;
  date: string; // YYYY-MM-DD
  state: DayState;
}

interface WeeklyCalendarRowProps {
  activeProgram: WorkoutProgramLocal | null;
}

// ── Helpers ────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(d: Date): string {
  return getDateString(d);
}

// ── Component ──────────────────────────────────────────────────────

export function WeeklyCalendarRow({ activeProgram }: WeeklyCalendarRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const history = useWorkoutStore((s) => s.history);

  const days = useMemo((): DayInfo[] => {
    const today = new Date();
    const todayKey = toDateKey(today);
    const monday = getMonday(today);

    // Build set of completed workout dates this week
    const completedDates = new Set<string>();
    for (const session of history) {
      const sessionDate = toDateKey(new Date(session.completedAt));
      completedDates.add(sessionDate);
    }

    // Build set of rest day indices from the program schedule
    const restDayIndices = new Set<number>();
    if (activeProgram) {
      for (const day of activeProgram.days) {
        if (day.dayType === 'rest') {
          // dayNumber is 1-indexed; map to 0-indexed week position
          const idx = (day.dayNumber - 1) % 7;
          restDayIndices.add(idx);
        }
      }
    }

    return DAY_LABELS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = toDateKey(d);

      let state: DayState;
      if (completedDates.has(dateKey)) {
        state = 'completed';
      } else if (dateKey === todayKey) {
        state = 'today';
      } else if (d < today) {
        state = restDayIndices.has(i) ? 'rest' : 'past';
      } else {
        state = restDayIndices.has(i) ? 'rest' : 'upcoming';
      }

      return { label, date: dateKey, state };
    });
  }, [history, activeProgram]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.base,
        },
      ]}
    >
      {days.map((day) => {
        const isToday = day.state === 'today';
        const isCompleted = day.state === 'completed';
        const isRest = day.state === 'rest';
        const isPast = day.state === 'past';

        return (
          <View key={day.date} style={styles.dayColumn}>
            <Text
              style={[
                typography.caption,
                {
                  color: isToday ? colors.primary : colors.textTertiary,
                  fontWeight: isToday ? '700' : '400',
                  marginBottom: spacing.xs,
                },
              ]}
            >
              {day.label}
            </Text>

            <View
              style={[
                styles.indicator,
                {
                  borderRadius: radius.full ?? 16,
                  backgroundColor: isCompleted
                    ? colors.completed
                    : isToday
                      ? colors.primary
                      : 'transparent',
                  borderWidth: !isCompleted && !isToday ? 1.5 : 0,
                  borderColor: isRest
                    ? colors.textTertiary
                    : isPast
                      ? colors.borderLight
                      : colors.border,
                },
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color={colors.textInverse} />
              ) : isToday ? (
                <Ionicons name="arrow-forward" size={12} color={colors.textInverse} />
              ) : isRest ? (
                <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 14 }}>—</Text>
              ) : (
                <View style={[styles.dot, { backgroundColor: isPast ? colors.borderLight : colors.border }]} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  indicator: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
