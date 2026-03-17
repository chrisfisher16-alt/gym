import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useSavedMeals } from '../../src/hooks/useSavedMeals';
import { Card, ScreenContainer, Badge, EmptyState } from '../../src/components/ui';
import { getMealTypeLabel, calculateMealTotals } from '../../src/lib/nutrition-utils';
import type { MealType } from '../../src/types/nutrition';

export default function SavedMealsScreen() {
  const router = useRouter();
  const { mealType } = useLocalSearchParams<{ mealType: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { sortedByUse, logSavedMeal, deleteSavedMeal, getSavedMealTotals } = useSavedMeals();

  const handleLogSavedMeal = (savedMealId: string, defaultType: MealType) => {
    const type = (mealType as MealType) || defaultType;
    logSavedMeal(savedMealId, type);
    router.dismiss();
  };

  const handleDelete = (savedMealId: string, name: string) => {
    Alert.alert('Delete Saved Meal', `Remove "${name}" from saved meals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSavedMeal(savedMealId),
      },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Saved Meals
        </Text>
      </View>

      {sortedByUse.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="No Saved Meals"
          description="Save your frequently eaten meals for quick logging."
        />
      ) : (
        <View style={{ marginBottom: spacing['2xl'] }}>
          {sortedByUse.map((saved) => {
            const totals = getSavedMealTotals(saved);
            return (
              <TouchableOpacity
                key={saved.id}
                activeOpacity={0.7}
                onPress={() => handleLogSavedMeal(saved.id, saved.mealType)}
                onLongPress={() => handleDelete(saved.id, saved.name)}
              >
                <Card style={{ marginBottom: spacing.sm }}>
                  <View style={styles.mealRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.mealHeader}>
                        <Text style={[typography.labelLarge, { color: colors.text }]}>
                          {saved.name}
                        </Text>
                        <Badge label={getMealTypeLabel(saved.mealType)} variant="default" />
                      </View>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                        {saved.items.map((i) => i.name).join(', ')}
                      </Text>
                      <View style={[styles.macroSummary, { marginTop: spacing.sm }]}>
                        <Text style={[typography.bodySmall, { color: colors.text }]}>
                          {Math.round(totals.calories)} cal
                        </Text>
                        <Text style={[typography.caption, { color: colors.protein }]}>
                          P: {Math.round(totals.protein_g)}g
                        </Text>
                        <Text style={[typography.caption, { color: colors.carbs }]}>
                          C: {Math.round(totals.carbs_g)}g
                        </Text>
                        <Text style={[typography.caption, { color: colors.fat }]}>
                          F: {Math.round(totals.fat_g)}g
                        </Text>
                      </View>
                      {saved.useCount > 0 && (
                        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                          Used {saved.useCount} time{saved.useCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.hint, { marginTop: spacing.md }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
            <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: spacing.xs }]}>
              Tap to log · Long press to delete
            </Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
