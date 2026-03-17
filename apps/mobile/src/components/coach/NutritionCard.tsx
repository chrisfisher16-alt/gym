import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

interface NutritionCardProps {
  data: Record<string, unknown>;
}

export function NutritionCard({ data }: NutritionCardProps) {
  const { colors, spacing, typography } = useTheme();

  const targets = (data.targets ?? data) as Record<string, number>;
  const calories = targets.calories ?? 0;
  const protein = targets.protein_g ?? 0;
  const carbs = targets.carbs_g ?? 0;
  const fat = targets.fat_g ?? 0;
  const calculation = data.calculation as Record<string, unknown> | undefined;

  return (
    <Card style={{ backgroundColor: colors.surfaceSecondary }}>
      <View style={styles.header}>
        <Ionicons name="nutrition" size={20} color={colors.primary} />
        <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
          Daily Targets
        </Text>
        <Text style={[typography.caption, { color: colors.primary }]}>AI Calculated</Text>
      </View>

      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <View style={styles.macroRow}>
          <Text style={[typography.label, { color: colors.text }]}>Calories</Text>
          <Text style={[typography.labelLarge, { color: colors.calories }]}>{calories} kcal</Text>
        </View>

        {[
          { label: 'Protein', value: protein, unit: 'g', color: colors.protein },
          { label: 'Carbs', value: carbs, unit: 'g', color: colors.carbs },
          { label: 'Fat', value: fat, unit: 'g', color: colors.fat },
        ].map((macro) => (
          <View key={macro.label}>
            <View style={styles.macroRow}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{macro.label}</Text>
              <Text style={[typography.label, { color: macro.color }]}>
                {macro.value}{macro.unit}
              </Text>
            </View>
            <ProgressBar
              progress={macro.value > 0 ? 1 : 0}
              color={macro.color}
              height={4}
              style={{ marginTop: 4 }}
            />
          </View>
        ))}
      </View>

      {calculation && (
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.md }]}>
          Based on {calculation.method as string} equation · TDEE: {calculation.tdee as number} kcal · Goal: {calculation.goal_adjustment as string}
        </Text>
      )}

      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
        These are estimates. Adjust based on your results.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
