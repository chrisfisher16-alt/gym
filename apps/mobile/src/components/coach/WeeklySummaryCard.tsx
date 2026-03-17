import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

interface WeeklySummaryCardProps {
  data: Record<string, unknown>;
}

export function WeeklySummaryCard({ data }: WeeklySummaryCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const period = data.period as { start: string; end: string } | undefined;
  const workoutAdherence = data.workout_adherence as {
    completed: number;
    planned: number;
    percentage: number;
  } | undefined;
  const nutritionAdherence = data.nutrition_adherence as {
    avg_calories: number;
    target_calories: number;
    avg_protein_g: number;
    target_protein_g: number;
    percentage: number;
  } | undefined;
  const prs = (data.prs_achieved as Array<{ exercise: string; value: string }>) ?? [];
  const trends = data.trends as { workout: string; nutrition: string; overall: string } | undefined;
  const recommendations = (data.recommendations as string[]) ?? [];
  const motivation = (data.motivational_message as string) ?? '';

  const trendIcon = (trend: string) => {
    if (trend === 'improving') return { name: 'trending-up' as const, color: colors.success };
    if (trend === 'declining') return { name: 'trending-down' as const, color: colors.error };
    return { name: 'remove-outline' as const, color: colors.warning };
  };

  return (
    <Card style={{ backgroundColor: colors.surfaceSecondary }}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={20} color={colors.primary} />
        <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
          Weekly Summary
        </Text>
        {period && (
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {period.start} – {period.end}
          </Text>
        )}
      </View>

      {/* Motivation message */}
      {motivation ? (
        <View style={[styles.motivationBox, { backgroundColor: colors.primaryMuted, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }]}>
          <Text style={[typography.body, { color: colors.primary }]}>{motivation}</Text>
        </View>
      ) : null}

      {/* Workout adherence */}
      {workoutAdherence && (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.metricRow}>
            <Text style={[typography.label, { color: colors.text }]}>Workouts</Text>
            <Text style={[typography.label, { color: colors.text }]}>
              {workoutAdherence.completed}/{workoutAdherence.planned}
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(workoutAdherence.percentage / 100, 1)}
            color={workoutAdherence.percentage >= 80 ? colors.success : colors.warning}
            height={6}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      )}

      {/* Nutrition adherence */}
      {nutritionAdherence && nutritionAdherence.avg_calories > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.metricRow}>
            <Text style={[typography.label, { color: colors.text }]}>Nutrition</Text>
            <Text style={[typography.label, { color: colors.text }]}>
              {nutritionAdherence.avg_calories} / {nutritionAdherence.target_calories} cal avg
            </Text>
          </View>
          <ProgressBar
            progress={Math.min(nutritionAdherence.percentage / 100, 1)}
            color={nutritionAdherence.percentage >= 85 ? colors.success : colors.warning}
            height={6}
            style={{ marginTop: spacing.xs }}
          />
        </View>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
            PRs This Week
          </Text>
          {prs.map((pr, i) => (
            <View key={i} style={styles.prRow}>
              <Ionicons name="trophy" size={14} color={colors.warning} />
              <Text style={[typography.bodySmall, { color: colors.text, marginLeft: spacing.xs }]}>
                {pr.exercise}: {pr.value}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Trends */}
      {trends && (
        <View style={[styles.trendsRow, { marginTop: spacing.md, gap: spacing.md }]}>
          {(['workout', 'nutrition', 'overall'] as const).map((key) => {
            const t = trends[key] as string;
            const icon = trendIcon(t);
            return (
              <View key={key} style={styles.trendItem}>
                <Ionicons name={icon.name} size={18} color={icon.color} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
            Recommendations
          </Text>
          {recommendations.map((rec, i) => (
            <Text key={i} style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              • {rec}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  motivationBox: {},
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  trendsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trendItem: {
    alignItems: 'center',
  },
});
