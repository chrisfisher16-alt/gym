import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useMealLog } from '../../src/hooks/useMealLog';
import { Card, Button, Badge } from '../../src/components/ui';
import { calculateMealTotals, generateNutritionId } from '../../src/lib/nutrition-utils';
import type { MealItemEntry, MealType } from '../../src/types/nutrition';
import { SafeAreaView } from 'react-native-safe-area-context';

// Simulated photo analysis results — will be replaced by AI in Phase 4
function generateMockPhotoItems(): MealItemEntry[] {
  return [
    { id: generateNutritionId('mi'), name: 'Grilled Chicken', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, quantity: 1, unit: 'serving', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'White Rice', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, quantity: 1, unit: 'cup', is_estimate: true },
    { id: generateNutritionId('mi'), name: 'Mixed Vegetables', calories: 45, protein_g: 2, carbs_g: 8, fat_g: 0.5, fiber_g: 3, quantity: 1, unit: 'cup', is_estimate: true },
  ];
}

export default function PhotoReviewScreen() {
  const router = useRouter();
  const { imageUri, mealType = 'lunch' } = useLocalSearchParams<{ imageUri: string; mealType: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { logMeal } = useMealLog();

  const [items, setItems] = useState<MealItemEntry[]>(generateMockPhotoItems());
  const [mealName, setMealName] = useState('Photo Meal');

  const updateItem = (itemId: string, field: keyof MealItemEntry, value: string) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
        if (field === 'name') return { ...item, name: value };
        const numVal = parseFloat(value) || 0;
        return { ...item, [field]: numVal };
      }),
    );
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
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
      },
    ]);
  };

  const handleSave = () => {
    if (items.length === 0) return;

    logMeal({
      mealType: mealType as MealType,
      name: mealName,
      source: 'photo',
      timestamp: new Date().toISOString(),
      items,
      photoUri: imageUri ? decodeURIComponent(imageUri) : undefined,
    });

    // Navigate back to the nutrition tab
    router.dismiss(2);
  };

  const totals = calculateMealTotals(items);

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
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
            Review Meal
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing['2xl'] }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo */}
          {imageUri && (
            <Image
              source={{ uri: decodeURIComponent(imageUri) }}
              style={[styles.photo, { borderRadius: radius.lg, marginBottom: spacing.base }]}
              resizeMode="cover"
            />
          )}

          {/* Estimate Warning */}
          <View style={[styles.warning, { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.base }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={[typography.bodySmall, { color: colors.warning, marginLeft: spacing.sm, flex: 1 }]}>
              Estimated values — please review and adjust before saving
            </Text>
          </View>

          {/* Meal Name */}
          <TextInput
            style={[
              styles.nameInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                color: colors.text,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                ...typography.label,
                marginBottom: spacing.base,
              },
            ]}
            placeholder="Meal name"
            placeholderTextColor={colors.textTertiary}
            value={mealName}
            onChangeText={setMealName}
          />

          {/* Items */}
          {items.map((item) => (
            <Card key={item.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.itemHeader}>
                <TextInput
                  style={[typography.label, { color: colors.text, flex: 1, padding: 0 }]}
                  value={item.name}
                  onChangeText={(v) => updateItem(item.id, 'name', v)}
                />
                <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>

              <Badge label="Estimate" variant="warning" />

              <View style={[styles.macroRow, { marginTop: spacing.sm }]}>
                {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => {
                  const labels: Record<string, string> = { calories: 'Cal', protein_g: 'P', carbs_g: 'C', fat_g: 'F' };
                  const fieldColors: Record<string, string> = { calories: colors.text, protein_g: colors.protein, carbs_g: colors.carbs, fat_g: colors.fat };
                  return (
                    <View key={field} style={styles.macroInput}>
                      <Text style={[typography.caption, { color: fieldColors[field] }]}>{labels[field]}</Text>
                      <TextInput
                        style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                        value={String(item[field])}
                        onChangeText={(v) => updateItem(item.id, field, v)}
                        keyboardType="numeric"
                      />
                    </View>
                  );
                })}
              </View>
            </Card>
          ))}

          {/* Add Item */}
          <TouchableOpacity
            style={[styles.addButton, { borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.lg }]}
            onPress={addItem}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Add Item</Text>
          </TouchableOpacity>

          {/* Totals */}
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>Total</Text>
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

          {/* Save */}
          <Button title="Save Meal" onPress={handleSave} disabled={items.length === 0} />
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
  photo: {
    width: '100%',
    height: 180,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    borderWidth: 1,
    minHeight: 44,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroInput: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  macroField: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
});
