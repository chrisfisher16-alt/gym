import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useMealLog } from '../../src/hooks/useMealLog';
import { Card, Button, Badge, ScreenContainer } from '../../src/components/ui';
import { analyzeMealText } from '../../src/lib/ai-meal-analyzer';
import { calculateMealTotals, generateNutritionId } from '../../src/lib/nutrition-utils';
import type { MealItemEntry, MealType } from '../../src/types/nutrition';

export default function TextLogScreen() {
  const router = useRouter();
  const { mealType = 'lunch' } = useLocalSearchParams<{ mealType: string }>();
  const { colors, spacing, radius, typography } = useTheme();
  const { logMeal } = useMealLog();

  const [text, setText] = useState('');
  const [parsedItems, setParsedItems] = useState<MealItemEntry[] | null>(null);
  const [mealName, setMealName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const items = await analyzeMealText(text);
      setParsedItems(items);
      if (!mealName) {
        setMealName(text.trim().substring(0, 40));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    if (!parsedItems) return;
    setParsedItems(parsedItems.filter((i) => i.id !== itemId));
  };

  const handleEditCalories = (itemId: string, value: string) => {
    if (!parsedItems) return;
    const cal = parseInt(value) || 0;
    setParsedItems(
      parsedItems.map((i) => (i.id === itemId ? { ...i, calories: cal } : i)),
    );
  };

  const handleEditProtein = (itemId: string, value: string) => {
    if (!parsedItems) return;
    const val = parseFloat(value) || 0;
    setParsedItems(
      parsedItems.map((i) => (i.id === itemId ? { ...i, protein_g: val } : i)),
    );
  };

  const handleSave = () => {
    if (!parsedItems || parsedItems.length === 0) return;

    logMeal({
      mealType: mealType as MealType,
      name: mealName || 'Meal',
      source: 'text',
      timestamp: new Date().toISOString(),
      items: parsedItems,
    });

    router.dismiss();
  };

  const totals = parsedItems ? calculateMealTotals(parsedItems) : null;

  return (
    <ScreenContainer scrollable={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
            Type Your Meal
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!parsedItems ? (
            <>
              {/* Input Phase */}
              <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                Describe what you ate. Separate items with commas or &quot;and&quot;.
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                    color: colors.text,
                    padding: spacing.base,
                    ...typography.bodyLarge,
                  },
                ]}
                placeholder="2 eggs, toast with butter, and a cup of coffee"
                placeholderTextColor={colors.textTertiary}
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                textAlignVertical="top"
              />

              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textTertiary, marginBottom: spacing.md }]}>
                  Examples: &quot;chicken breast with rice and broccoli&quot; · &quot;2 eggs, toast, coffee&quot; · &quot;protein shake, banana&quot;
                </Text>
              </View>

              {isAnalyzing ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                    Analyzing your meal with AI...
                  </Text>
                </View>
              ) : (
                <Button
                  title="Analyze with AI"
                  onPress={handleParse}
                  disabled={!text.trim()}
                  icon={<Ionicons name="sparkles" size={20} color={colors.textInverse} />}
                />
              )}
            </>
          ) : (
            <>
              {/* Review Phase */}
              <View style={[styles.reviewBanner, { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.base }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={[typography.bodySmall, { color: colors.warning, marginLeft: spacing.sm, flex: 1 }]}>
                  Estimated values — please review and adjust
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
              {parsedItems.map((item) => (
                <Card key={item.id} style={{ marginBottom: spacing.sm }}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.label, { color: colors.text }]}>{item.name}</Text>
                      {item.is_estimate && (
                        <Badge label="Estimate" variant="warning" />
                      )}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.macroInputRow, { marginTop: spacing.sm }]}>
                    <View style={styles.macroInput}>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>Cal</Text>
                      <TextInput
                        style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                        value={String(item.calories)}
                        onChangeText={(v) => handleEditCalories(item.id, v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.macroInput}>
                      <Text style={[typography.caption, { color: colors.protein }]}>P</Text>
                      <TextInput
                        style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                        value={String(item.protein_g)}
                        onChangeText={(v) => handleEditProtein(item.id, v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.macroInput}>
                      <Text style={[typography.caption, { color: colors.carbs }]}>C</Text>
                      <TextInput
                        style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                        value={String(item.carbs_g)}
                        onChangeText={(v) => {
                          if (!parsedItems) return;
                          setParsedItems(parsedItems.map((i) => i.id === item.id ? { ...i, carbs_g: parseFloat(v) || 0 } : i));
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.macroInput}>
                      <Text style={[typography.caption, { color: colors.fat }]}>F</Text>
                      <TextInput
                        style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                        value={String(item.fat_g)}
                        onChangeText={(v) => {
                          if (!parsedItems) return;
                          setParsedItems(parsedItems.map((i) => i.id === item.id ? { ...i, fat_g: parseFloat(v) || 0 } : i));
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </Card>
              ))}

              {/* Add Item */}
              <TouchableOpacity
                style={[styles.addItem, { borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.base }]}
                onPress={() => {
                  setParsedItems([
                    ...parsedItems,
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
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>
                  Add Item
                </Text>
              </TouchableOpacity>

              {/* Totals */}
              {totals && (
                <Card style={{ marginBottom: spacing.base }}>
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
              )}

              {/* Actions */}
              <View style={{ gap: spacing.sm, marginBottom: spacing['2xl'] }}>
                <Button title="Save Meal" onPress={handleSave} disabled={parsedItems.length === 0} />
                <Button
                  title="Back to Input"
                  variant="ghost"
                  onPress={() => setParsedItems(null)}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    height: 140,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  nameInput: {
    borderWidth: 1,
    minHeight: 44,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  macroInputRow: {
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
    paddingHorizontal: 4,
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
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
});
