import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Card } from '../ui/Card';

interface MealAnalysisCardProps {
  data: Record<string, unknown>;
}

export function MealAnalysisCard({ data }: MealAnalysisCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const items = (data.items as Array<Record<string, unknown>>) ?? [];
  const parseMethod = (data.parse_method as string) ?? 'ai';

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + ((item.calories as number) ?? 0),
      protein_g: acc.protein_g + ((item.protein_g as number) ?? 0),
      carbs_g: acc.carbs_g + ((item.carbs_g as number) ?? 0),
      fat_g: acc.fat_g + ((item.fat_g as number) ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <Card style={{ backgroundColor: colors.surfaceSecondary }}>
      <View style={styles.header}>
        <Ionicons name="restaurant" size={20} color={colors.primary} />
        <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
          Meal Analysis
        </Text>
        <Text style={[typography.caption, { color: colors.warning }]}>Estimates</Text>
      </View>

      {/* Item list */}
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {items.map((item, index) => (
          <View
            key={index}
            style={[
              styles.itemRow,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.sm,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>
                {(item.name as string) ?? 'Food item'}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {item.quantity ?? 1} {(item.unit as string) ?? 'serving'}
              </Text>
            </View>
            <View style={styles.macros}>
              <Text style={[typography.bodySmall, { color: colors.text }]}>
                {Math.round((item.calories as number) ?? 0)} cal
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                P:{Math.round((item.protein_g as number) ?? 0)} C:{Math.round((item.carbs_g as number) ?? 0)} F:{Math.round((item.fat_g as number) ?? 0)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      {items.length > 1 && (
        <View
          style={[
            styles.totals,
            {
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.text }]}>Total</Text>
          <View style={styles.macros}>
            <Text style={[typography.label, { color: colors.text }]}>
              {Math.round(totals.calories)} cal
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              P:{Math.round(totals.protein_g)} C:{Math.round(totals.carbs_g)} F:{Math.round(totals.fat_g)}
            </Text>
          </View>
        </View>
      )}

      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm, fontStyle: 'italic' }]}>
        {parseMethod === 'database_fallback'
          ? 'Estimated from food database. Review and adjust as needed.'
          : 'AI-estimated macros. Review and adjust as needed.'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macros: {
    alignItems: 'flex-end',
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
