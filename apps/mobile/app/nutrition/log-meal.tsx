import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useMealLog } from '../../src/hooks/useMealLog';
import { useSavedMeals } from '../../src/hooks/useSavedMeals';
import { Card, ScreenContainer, Badge } from '../../src/components/ui';
import {
  getMealTypeLabel,
  formatMealTime,
  calculateMealTotals,
  suggestMealType,
} from '../../src/lib/nutrition-utils';
import type { MealType } from '../../src/types/nutrition';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const LOG_METHODS = [
  { id: 'text', icon: 'create-outline' as const, label: 'Type it', description: 'Describe your meal', route: '/nutrition/text-log' },
  { id: 'quick', icon: 'flash-outline' as const, label: 'Quick Add', description: 'Enter calories directly', route: '/nutrition/quick-add' },
  { id: 'photo', icon: 'camera-outline' as const, label: 'Photo', description: 'Snap a photo', route: '/nutrition/photo-log' },
  { id: 'saved', icon: 'bookmark-outline' as const, label: 'Saved Meals', description: 'From templates', route: '/nutrition/saved-meals' },
];

export default function LogMealScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { recentMeals } = useMealLog();
  const [selectedType, setSelectedType] = useState<MealType>(suggestMealType() as MealType);

  const handleMethodPress = (route: string) => {
    router.push(`${route}?mealType=${selectedType}` as any);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Log Meal
        </Text>
      </View>

      {/* Meal Type Selector */}
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          Meal Type
        </Text>
        <View style={styles.mealTypeRow}>
          {MEAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.mealTypeChip,
                {
                  backgroundColor: selectedType === type ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.sm,
                },
              ]}
              onPress={() => setSelectedType(type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  typography.label,
                  { color: selectedType === type ? colors.textInverse : colors.text },
                ]}
              >
                {getMealTypeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logging Methods */}
      <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
        How would you like to log?
      </Text>
      <View style={[styles.methodGrid, { marginBottom: spacing.xl }]}>
        {LOG_METHODS.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                padding: spacing.base,
              },
            ]}
            onPress={() => handleMethodPress(method.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.methodIcon, { backgroundColor: colors.primaryMuted, borderRadius: radius.md }]}>
              <Ionicons name={method.icon} size={24} color={colors.primary} />
            </View>
            <Text style={[typography.label, { color: colors.text, marginTop: spacing.sm }]}>
              {method.label}
            </Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              {method.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Meals */}
      {recentMeals.length > 0 && (
        <View style={{ marginBottom: spacing['2xl'] }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Recent Meals
          </Text>
          {recentMeals.slice(0, 5).map((meal) => {
            const totals = calculateMealTotals(meal.items);
            return (
              <TouchableOpacity
                key={meal.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/nutrition/meal-detail?mealId=${meal.id}`)}
              >
                <Card style={{ marginBottom: spacing.sm }}>
                  <View style={styles.recentMeal}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recentMealHeader}>
                        <Badge
                          label={getMealTypeLabel(meal.mealType)}
                          variant="default"
                        />
                        <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: spacing.sm }]}>
                          {formatMealTime(meal.timestamp)}
                        </Text>
                      </View>
                      <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }]}>
                        {meal.name}
                      </Text>
                    </View>
                    <Text style={[typography.label, { color: colors.textSecondary }]}>
                      {Math.round(totals.calories)} cal
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
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
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    width: '47%',
    flexGrow: 1,
  },
  methodIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentMealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
