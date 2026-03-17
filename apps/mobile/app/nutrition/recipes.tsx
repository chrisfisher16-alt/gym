import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { Card, Button, ScreenContainer, EmptyState, Badge } from '../../src/components/ui';
import { calculateMealTotals, generateNutritionId } from '../../src/lib/nutrition-utils';
import type { MealItemEntry, MealType } from '../../src/types/nutrition';

export default function RecipesScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const recipes = useNutritionStore((s) => s.recipes);
  const addRecipe = useNutritionStore((s) => s.addRecipe);
  const deleteRecipe = useNutritionStore((s) => s.deleteRecipe);
  const logRecipe = useNutritionStore((s) => s.logRecipe);

  const [showCreate, setShowCreate] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [servings, setServings] = useState('1');
  const [items, setItems] = useState<MealItemEntry[]>([]);

  const handleAddIngredient = () => {
    setItems([
      ...items,
      {
        id: generateNutritionId('ri'),
        name: '',
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        quantity: 1,
        unit: 'serving',
        is_estimate: false,
      },
    ]);
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim() || items.length === 0) {
      Alert.alert('Missing Info', 'Please add a name and at least one ingredient.');
      return;
    }

    addRecipe({
      name: recipeName.trim(),
      description: recipeDescription.trim(),
      items: items.filter((i) => i.name.trim() !== ''),
      servings: parseInt(servings) || 1,
    });

    setShowCreate(false);
    setRecipeName('');
    setRecipeDescription('');
    setServings('1');
    setItems([]);
  };

  const handleLogRecipe = (recipeId: string) => {
    logRecipe(recipeId, 'lunch' as MealType);
    Alert.alert('Logged', 'Recipe has been logged as a meal.');
  };

  const handleDeleteRecipe = (recipeId: string, name: string) => {
    Alert.alert('Delete Recipe', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecipe(recipeId) },
    ]);
  };

  return (
    <ScreenContainer scrollable={!showCreate}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Recipes
        </Text>
        {!showCreate && (
          <TouchableOpacity onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {showCreate ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Card style={{ marginBottom: spacing.base }}>
              <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
                Create Recipe
              </Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, ...typography.body, marginBottom: spacing.md }]}
                placeholder="Recipe name"
                placeholderTextColor={colors.textTertiary}
                value={recipeName}
                onChangeText={setRecipeName}
              />

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, ...typography.body, marginBottom: spacing.md }]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textTertiary}
                value={recipeDescription}
                onChangeText={setRecipeDescription}
              />

              <View style={[styles.servingsRow, { marginBottom: spacing.md }]}>
                <Text style={[typography.label, { color: colors.textSecondary }]}>Servings:</Text>
                <TextInput
                  style={[styles.smallInput, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="numeric"
                />
              </View>
            </Card>

            {/* Ingredients */}
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
              Ingredients
            </Text>

            {items.map((item, index) => (
              <Card key={item.id} style={{ marginBottom: spacing.sm }}>
                <View style={styles.ingredientRow}>
                  <TextInput
                    style={[typography.label, { color: colors.text, flex: 1, padding: 0 }]}
                    placeholder="Ingredient name"
                    placeholderTextColor={colors.textTertiary}
                    value={item.name}
                    onChangeText={(v) => setItems(items.map((i) => i.id === item.id ? { ...i, name: v } : i))}
                  />
                  <TouchableOpacity onPress={() => setItems(items.filter((i) => i.id !== item.id))}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.macroRow, { marginTop: spacing.sm }]}>
                  {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => {
                    const labels: Record<string, string> = { calories: 'Cal', protein_g: 'P(g)', carbs_g: 'C(g)', fat_g: 'F(g)' };
                    return (
                      <View key={field} style={styles.macroItem}>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>{labels[field]}</Text>
                        <TextInput
                          style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                          value={String(item[field] || '')}
                          onChangeText={(v) => setItems(items.map((i) => i.id === item.id ? { ...i, [field]: parseFloat(v) || 0 } : i))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.textTertiary}
                        />
                      </View>
                    );
                  })}
                </View>
              </Card>
            ))}

            <TouchableOpacity
              style={[styles.addButton, { borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.lg }]}
              onPress={handleAddIngredient}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Add Ingredient</Text>
            </TouchableOpacity>

            {items.length > 0 && (
              <Card style={{ marginBottom: spacing.lg }}>
                <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Per serving totals:</Text>
                {(() => {
                  const totals = calculateMealTotals(items);
                  const s = parseInt(servings) || 1;
                  return (
                    <Text style={[typography.body, { color: colors.text }]}>
                      {Math.round(totals.calories / s)} cal · P: {Math.round(totals.protein_g / s)}g · C: {Math.round(totals.carbs_g / s)}g · F: {Math.round(totals.fat_g / s)}g
                    </Text>
                  );
                })()}
              </Card>
            )}

            <View style={{ gap: spacing.sm, marginBottom: spacing['2xl'] }}>
              <Button title="Save Recipe" onPress={handleSaveRecipe} />
              <Button title="Cancel" variant="ghost" onPress={() => { setShowCreate(false); setItems([]); }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <>
          {recipes.length === 0 ? (
            <EmptyState
              icon="book-outline"
              title="No Recipes Yet"
              description="Create recipes to quickly log meals with known macros."
              actionLabel="Create Recipe"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <View style={{ marginBottom: spacing['2xl'] }}>
              {recipes.map((recipe) => {
                const totals = calculateMealTotals(recipe.items);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    activeOpacity={0.7}
                    onLongPress={() => handleDeleteRecipe(recipe.id, recipe.name)}
                  >
                    <Card style={{ marginBottom: spacing.sm }}>
                      <View style={styles.recipeRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.labelLarge, { color: colors.text }]}>{recipe.name}</Text>
                          {recipe.description ? (
                            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                              {recipe.description}
                            </Text>
                          ) : null}
                          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                            {recipe.items.length} ingredients · {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                            Per serving: {Math.round(totals.calories / recipe.servings)} cal · P: {Math.round(totals.protein_g / recipe.servings)}g · C: {Math.round(totals.carbs_g / recipe.servings)}g · F: {Math.round(totals.fat_g / recipe.servings)}g
                          </Text>
                        </View>
                        <Button
                          title="Log"
                          size="sm"
                          fullWidth={false}
                          onPress={() => handleLogRecipe(recipe.id)}
                        />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}

              <View style={[styles.hint, { marginTop: spacing.md }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: spacing.xs }]}>
                  Long press to delete
                </Text>
              </View>
            </View>
          )}
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
  input: {
    minHeight: 44,
    paddingVertical: 10,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallInput: {
    width: 60,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 36,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  macroField: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 6,
    minHeight: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
