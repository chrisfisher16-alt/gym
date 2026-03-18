import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Card } from '../ui/Card';

interface WorkoutPlanCardProps {
  data: Record<string, unknown>;
}

export function WorkoutPlanCard({ data }: WorkoutPlanCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const plan = (data.workout_plan ?? data) as Record<string, unknown>;
  const name = (plan.name as string) ?? 'Workout Plan';
  const description = (plan.description as string) ?? '';
  const days = (plan.days as Array<Record<string, unknown>>) ?? [];

  return (
    <Card style={{ backgroundColor: colors.surfaceSecondary }}>
      <View style={styles.header}>
        <Ionicons name="barbell" size={20} color={colors.primary} />
        <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
          {name}
        </Text>
        <Text style={[typography.caption, { color: colors.primary }]}>AI Generated</Text>
      </View>

      {description ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {description}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {days.map((day, index) => {
          const dayNum = (day.day_number as number) ?? index + 1;
          const dayName = (day.name as string) ?? `Day ${dayNum}`;
          const exercises = (day.exercises as Array<Record<string, unknown>>) ?? [];
          const isExpanded = expandedDay === index;

          return (
            <TouchableOpacity
              key={index}
              onPress={() => setExpandedDay(isExpanded ? null : index)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.dayHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.label, { color: colors.text }]}>
                      Day {dayNum}: {dayName}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textTertiary }]}>
                      {exercises.length} exercises
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textTertiary}
                  />
                </View>

                {isExpanded && exercises.length > 0 && (
                  <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                    {exercises.map((ex, exIndex) => (
                      <View key={exIndex} style={styles.exerciseRow}>
                        <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]}>
                          {(ex.exercise_name as string) ?? (ex.name as string) ?? 'Exercise'}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>
                          {String(ex.target_sets ?? ex.sets ?? 3)}×{String(ex.target_reps ?? ex.reps ?? '8-12')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCard: {},
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
});
