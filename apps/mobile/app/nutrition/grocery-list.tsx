import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, Button, ScreenContainer } from '../../src/components/ui';
import { useGroceryStore, type GroceryList, type GroceryCategory } from '../../src/stores/grocery-store';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { sendAIMessage } from '../../src/lib/ai-client';

const DAY_OPTIONS = [3, 5, 7] as const;

export default function GroceryListScreen() {
  const router = useRouter();
  const { colors, spacing, typography, radius } = useTheme();
  const profile = useProfileStore((s) => s.profile);
  const targets = useNutritionStore((s) => s.targets);
  const savedMeals = useNutritionStore((s) => s.savedMeals);

  const currentList = useGroceryStore((s) => s.currentList);
  const isInitialized = useGroceryStore((s) => s.isInitialized);
  const initialize = useGroceryStore((s) => s.initialize);
  const setList = useGroceryStore((s) => s.setList);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const clearList = useGroceryStore((s) => s.clearList);

  const [selectedDays, setSelectedDays] = useState<3 | 5 | 7>(7);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  // ── AI Generation ──────────────────────────────────────────────

  const generateWithAI = useCallback(async () => {
    setGenerating(true);
    try {
      const restrictions = profile.dietaryRestrictions || 'none';
      const prompt = `Generate a grocery list for ${selectedDays} days of meals.

Nutrition targets per day:
- Calories: ${targets.calories} kcal
- Protein: ${targets.protein_g}g
- Carbs: ${targets.carbs_g}g
- Fat: ${targets.fat_g}g

Dietary restrictions: ${restrictions}

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "categories": [
    {
      "name": "Protein",
      "items": [{ "name": "Chicken breast", "quantity": "2 lbs", "estimatedCost": 8.99 }]
    },
    {
      "name": "Produce",
      "items": [{ "name": "Broccoli", "quantity": "2 heads", "estimatedCost": 3.50 }]
    }
  ]
}

Categories should include: Protein, Produce, Dairy, Grains, Pantry, Frozen, Beverages (only if items exist).
Include estimated cost per item in USD. Make quantities realistic for ${selectedDays} days feeding 1 person.`;

      const response = await sendAIMessage(prompt, {
        systemPrompt: 'You are a nutrition assistant. Return only valid JSON, no markdown fences, no explanation text.',
        context: 'nutrition',
      });

      // Parse AI response - strip markdown fences if present
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const categories: GroceryCategory[] = (parsed.categories ?? []).map(
        (cat: { name: string; items: Array<{ name: string; quantity: string; estimatedCost?: number }> }) => ({
          name: cat.name,
          items: (cat.items ?? []).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            checked: false,
            estimatedCost: item.estimatedCost,
          })),
        }),
      );

      const totalCost = categories.reduce(
        (sum, cat) => sum + cat.items.reduce((s, item) => s + (item.estimatedCost ?? 0), 0),
        0,
      );

      const list: GroceryList = {
        id: `grocery_${Date.now()}`,
        categories,
        createdAt: new Date().toISOString(),
        daysPlanned: selectedDays,
        totalEstimatedCost: totalCost > 0 ? totalCost : undefined,
      };

      setList(list);
    } catch (e) {
      console.warn('Grocery generation failed:', e);
      Alert.alert('Generation Failed', 'Could not generate grocery list. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [selectedDays, targets, profile.dietaryRestrictions, setList]);

  // ── Share ──────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!currentList) return;
    const lines: string[] = [`Grocery List (${currentList.daysPlanned} days)\n`];
    for (const cat of currentList.categories) {
      lines.push(`\n${cat.name.toUpperCase()}`);
      for (const item of cat.items) {
        const check = item.checked ? '[x]' : '[ ]';
        lines.push(`${check} ${item.name} - ${item.quantity}`);
      }
    }
    if (currentList.totalEstimatedCost) {
      lines.push(`\nEstimated Total: $${currentList.totalEstimatedCost.toFixed(2)}`);
    }
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  }, [currentList]);

  // ── Clear ──────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    Alert.alert('Clear List', 'Are you sure you want to clear the current grocery list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearList },
    ]);
  }, [clearList]);

  // ── Progress stats ─────────────────────────────────────────────

  const progress = useMemo(() => {
    if (!currentList) return { total: 0, checked: 0 };
    let total = 0;
    let checked = 0;
    for (const cat of currentList.categories) {
      for (const item of cat.items) {
        total++;
        if (item.checked) checked++;
      }
    }
    return { total, checked };
  }, [currentList]);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Grocery List
        </Text>
        {currentList && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity onPress={handleShare} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="share-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Generate Section */}
      {!currentList && (
        <View style={{ marginBottom: spacing.lg }}>
          <Card>
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
              Generate a Grocery List
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.base }]}>
              Let AI create a grocery list based on your nutrition targets and dietary preferences.
            </Text>

            {/* Days Selector */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
              Plan for:
            </Text>
            <View style={[styles.daysRow, { marginBottom: spacing.lg }]}>
              {DAY_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setSelectedDays(d)}
                  style={[
                    styles.dayOption,
                    {
                      backgroundColor: selectedDays === d ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.md,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.base,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      { color: selectedDays === d ? colors.textInverse : colors.textSecondary },
                    ]}
                  >
                    {d} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target summary */}
            <View style={[styles.targetSummary, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }]}>
              <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.xs }]}>
                YOUR DAILY TARGETS
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {targets.calories} cal · {targets.protein_g}g protein · {targets.carbs_g}g carbs · {targets.fat_g}g fat
              </Text>
              {profile.dietaryRestrictions ? (
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                  Restrictions: {profile.dietaryRestrictions}
                </Text>
              ) : null}
            </View>

            <Button
              title={generating ? 'Generating...' : 'Generate with AI'}
              onPress={generateWithAI}
              disabled={generating}
              loading={generating}
              icon={!generating ? <Ionicons name="sparkles" size={18} color={colors.textInverse} /> : undefined}
            />
          </Card>
        </View>
      )}

      {/* Current List */}
      {currentList && (
        <>
          {/* Progress bar */}
          <Card style={{ marginBottom: spacing.base }}>
            <View style={styles.progressRow}>
              <Text style={[typography.label, { color: colors.text }]}>
                {progress.checked} / {progress.total} items
              </Text>
              {currentList.totalEstimatedCost != null && (
                <Text style={[typography.label, { color: colors.success }]}>
                  ~${currentList.totalEstimatedCost.toFixed(2)}
                </Text>
              )}
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, marginTop: spacing.sm }]}>
              <View
                style={{
                  height: 6,
                  borderRadius: radius.sm,
                  backgroundColor: colors.success,
                  width: progress.total > 0 ? `${(progress.checked / progress.total) * 100}%` : '0%',
                }}
              />
            </View>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              {currentList.daysPlanned}-day plan · Created {new Date(currentList.createdAt).toLocaleDateString()}
            </Text>
          </Card>

          {/* Categories */}
          {currentList.categories.map((category, catIdx) => (
            <View key={category.name} style={{ marginBottom: spacing.base }}>
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>
                {category.name}
              </Text>
              <Card padded={false}>
                {category.items.map((item, itemIdx) => (
                  <TouchableOpacity
                    key={`${item.name}-${itemIdx}`}
                    onPress={() => toggleItem(catIdx, itemIdx)}
                    style={[
                      styles.groceryItem,
                      {
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.md,
                        borderBottomWidth: itemIdx < category.items.length - 1 ? 1 : 0,
                        borderBottomColor: colors.borderLight,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.checked ? colors.success : colors.textTertiary}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text
                        style={[
                          typography.label,
                          {
                            color: item.checked ? colors.textTertiary : colors.text,
                            textDecorationLine: item.checked ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {item.quantity}
                      </Text>
                    </View>
                    {item.estimatedCost != null && (
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        ${item.estimatedCost.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
          ))}

          {/* Regenerate */}
          <View style={{ marginBottom: spacing['2xl'] }}>
            <Button
              title="Generate New List"
              variant="secondary"
              onPress={() => {
                Alert.alert('New List', 'This will replace your current grocery list.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Continue',
                    onPress: () => {
                      clearList();
                    },
                  },
                ]);
              }}
            />
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dayOption: {
    alignItems: 'center',
  },
  targetSummary: {},
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarBg: {
    height: 6,
    overflow: 'hidden',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
