import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useMealLog } from '../../src/hooks/useMealLog';
import { Card, Button, Badge } from '../../src/components/ui';
import { calculateMealTotals, generateNutritionId, getMealTypeLabel, formatMealTime } from '../../src/lib/nutrition-utils';
import type { MealItemEntry } from '../../src/types/nutrition';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MealDetailScreen() {
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { getMealById, deleteMeal, addMealItem, editMealItem, removeMealItem } = useMealLog();
  const saveMealAsTemplate = useNutritionStore((s) => s.saveMealAsTemplate);

  const meal = getMealById(mealId ?? '');
  const [editing, setEditing] = useState(false);

  if (!meal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base, paddingTop: spacing.base }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md }]}>
            Meal Not Found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totals = calculateMealTotals(meal.items);

  const handleDelete = () => {
    Alert.alert('Delete Meal', 'Are you sure you want to delete this meal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMeal(meal.id);
          router.back();
        },
      },
    ]);
  };

  const handleSaveAsTemplate = () => {
    saveMealAsTemplate(meal);
    Alert.alert('Saved', `"${meal.name}" has been saved as a meal template.`);
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Remove Item', 'Remove this item from the meal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMealItem(meal.id, itemId),
      },
    ]);
  };

  const handleAddItem = () => {
    const newItem: MealItemEntry = {
      id: generateNutritionId('mi'),
      name: 'New Item',
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      quantity: 1,
      unit: 'serving',
      is_estimate: true,
    };
    addMealItem(meal.id, newItem);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: spacing.base, paddingBottom: spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]} numberOfLines={1}>
            {meal.name}
          </Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <Text style={[typography.label, { color: colors.primary }]}>
              {editing ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing['2xl'] }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Meal Info */}
          <View style={[styles.mealInfo, { marginBottom: spacing.base }]}>
            <Badge
              label={getMealTypeLabel(meal.mealType)}
              variant={
                meal.mealType === 'breakfast' ? 'warning' :
                meal.mealType === 'lunch' ? 'info' :
                meal.mealType === 'dinner' ? 'pro' : 'default'
              }
            />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
              {formatMealTime(meal.timestamp)}
            </Text>
            {meal.source !== 'manual' && (
              <Badge label={meal.source.replace('_', ' ')} variant="default" />
            )}
          </View>

          {/* Totals Summary */}
          <Card style={{ marginBottom: spacing.base }}>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={[typography.displayMedium, { color: colors.text }]}>{Math.round(totals.calories)}</Text>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>cal</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[typography.labelLarge, { color: colors.protein }]}>{Math.round(totals.protein_g)}g</Text>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>protein</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[typography.labelLarge, { color: colors.carbs }]}>{Math.round(totals.carbs_g)}g</Text>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>carbs</Text>
              </View>
              <View style={styles.totalItem}>
                <Text style={[typography.labelLarge, { color: colors.fat }]}>{Math.round(totals.fat_g)}g</Text>
                <Text style={[typography.caption, { color: colors.textTertiary }]}>fat</Text>
              </View>
            </View>
          </Card>

          {/* Items */}
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
            Items ({meal.items.length})
          </Text>

          {meal.items.map((item) => (
            <Card key={item.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  {editing ? (
                    <TextInput
                      style={[typography.label, { color: colors.text, padding: 0 }]}
                      value={item.name}
                      onChangeText={(v) => editMealItem(meal.id, item.id, { name: v })}
                    />
                  ) : (
                    <Text style={[typography.label, { color: colors.text }]}>{item.name}</Text>
                  )}
                  {item.is_estimate && <Badge label="Estimate" variant="warning" />}
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.itemMacros}>
                  <Text style={[typography.label, { color: colors.text }]}>{item.calories} cal</Text>
                  {editing && (
                    <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {editing && (
                <View style={[styles.editMacros, { marginTop: spacing.sm }]}>
                  {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => {
                    const labels: Record<string, string> = { calories: 'Cal', protein_g: 'P', carbs_g: 'C', fat_g: 'F' };
                    return (
                      <View key={field} style={styles.editMacroItem}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>{labels[field]}</Text>
                        <TextInput
                          style={[styles.editField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                          value={String(item[field])}
                          onChangeText={(v) => editMealItem(meal.id, item.id, { [field]: parseFloat(v) || 0 })}
                          keyboardType="numeric"
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          ))}

          {editing && (
            <TouchableOpacity
              style={[styles.addItem, { borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.base }]}
              onPress={handleAddItem}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Add Item</Text>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title="Save as Template"
              variant="secondary"
              onPress={handleSaveAsTemplate}
              icon={<Ionicons name="bookmark-outline" size={18} color={colors.text} />}
            />
            <Button
              title="Delete Meal"
              variant="danger"
              onPress={handleDelete}
              icon={<Ionicons name="trash-outline" size={18} color={colors.textInverse} />}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemMacros: {
    alignItems: 'flex-end',
    gap: 8,
  },
  editMacros: {
    flexDirection: 'row',
    gap: 8,
  },
  editMacroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  editField: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  addItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
