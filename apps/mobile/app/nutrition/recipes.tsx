import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useGroceryStore } from '../../src/stores/grocery-store';
import { Card, Button, ScreenContainer, EmptyState } from '../../src/components/ui';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { calculateMealTotals, generateNutritionId } from '../../src/lib/nutrition-utils';
import { generateRecipe } from '../../src/lib/ai-recipe-generator';
import type { MealItemEntry, MealType, RecipeDifficulty, RecipeEntry } from '../../src/types/nutrition';

const DIFFICULTY_COLORS: Record<RecipeDifficulty, string> = {
  Easy: '#10B981',
  Medium: '#F59E0B',
  Hard: '#EF4444',
};

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  seed: { label: 'Suggested', color: '#6366F1', icon: 'library-outline' },
  ai: { label: 'AI Generated', color: '#8B5CF6', icon: 'sparkles-outline' },
  user: { label: 'Custom', color: '#10B981', icon: 'person-outline' },
};

const FILTER_OPTIONS = ['All', 'Easy', 'Medium', 'Hard', 'AI', 'My Recipes'] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

export default function RecipesScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const recipes = useNutritionStore((s) => s.recipes);
  const addRecipe = useNutritionStore((s) => s.addRecipe);
  const deleteRecipe = useNutritionStore((s) => s.deleteRecipe);
  const logRecipe = useNutritionStore((s) => s.logRecipe);
  const groceryList = useGroceryStore((s) => s.currentList);
  const groceryInitialized = useGroceryStore((s) => s.isInitialized);
  const initializeGrocery = useGroceryStore((s) => s.initialize);
  const mergeRecipeItems = useGroceryStore((s) => s.mergeRecipeItems);
  const { fromGrocery } = useLocalSearchParams<{ fromGrocery?: string }>();

  // Ensure the grocery store is hydrated so the toggle and context work
  useEffect(() => {
    if (!groceryInitialized) initializeGrocery();
  }, [groceryInitialized, initializeGrocery]);

  // View state
  const [activeFilter, setActiveFilter] = useState<FilterOption>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Manual create state
  const [showCreate, setShowCreate] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [servings, setServings] = useState('1');
  const [items, setItems] = useState<MealItemEntry[]>([]);

  // AI generate state
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [useGroceries, setUseGroceries] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Count unchecked (available) grocery items
  const uncheckedGroceryCount = useMemo(() => {
    if (!groceryList) return 0;
    let count = 0;
    for (const cat of groceryList.categories) {
      for (const item of cat.items) {
        if (!item.checked) count++;
      }
    }
    return count;
  }, [groceryList]);

  // Auto-open AI generate view when navigating from the grocery list.
  // Must wait for groceryInitialized before checking uncheckedGroceryCount,
  // otherwise the count is 0 before AsyncStorage hydrates and the panel never opens.
  const didApplyGroceryParam = useRef(false);
  useEffect(() => {
    if (!fromGrocery || didApplyGroceryParam.current || !groceryInitialized) return;
    if (uncheckedGroceryCount > 0) {
      didApplyGroceryParam.current = true;
      setShowAIGenerate(true);
      setUseGroceries(true);
    }
  }, [fromGrocery, groceryInitialized, uncheckedGroceryCount]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;

    if (activeFilter === 'My Recipes') {
      result = result.filter((r) => r.source === 'user' || !r.source);
    } else if (activeFilter === 'AI') {
      result = result.filter((r) => r.source === 'ai');
    } else if (activeFilter === 'Easy' || activeFilter === 'Medium' || activeFilter === 'Hard') {
      result = result.filter((r) => r.difficulty === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.equipment?.some((e) => e.toLowerCase().includes(q)) ||
        r.ingredientsList?.some((i) => i.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [recipes, activeFilter, searchQuery]);

  // ── Manual Create Handlers ─────────────────────────────────────────

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
      crossPlatformAlert('Missing Info', 'Please add a name and at least one ingredient.');
      return;
    }

    const filteredItems = items.filter((i) => i.name.trim() !== '');
    const ingredientsList = filteredItems.map((i) =>
      `${i.quantity} ${i.unit} ${i.name}`.trim(),
    );
    addRecipe({
      name: recipeName.trim(),
      description: recipeDescription.trim(),
      items: filteredItems,
      servings: parseInt(servings) || 1,
      ingredientsList,
    });

    setShowCreate(false);
    setRecipeName('');
    setRecipeDescription('');
    setServings('1');
    setItems([]);
  };

  // ── AI Generate Handlers ───────────────────────────────────────────

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setAiError(null);

    try {
      const result = await generateRecipe({
        prompt: aiPrompt.trim(),
        useGroceryList: useGroceries,
      });

      addRecipe(result.recipe);
      setShowAIGenerate(false);
      setAiPrompt('');
      setUseGroceries(false);
      setActiveFilter('AI');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate recipe';
      setAiError(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, useGroceries, addRecipe]);

  // ── Common Handlers ────────────────────────────────────────────────

  const handleLogRecipe = (recipeId: string) => {
    const hour = new Date().getHours();
    const mealType: MealType = hour < 10 ? 'breakfast' : hour < 14 ? 'lunch' : hour < 17 ? 'snack' : 'dinner';
    logRecipe(recipeId, mealType);
    if (Platform.OS !== 'web') {
      crossPlatformAlert('Logged', 'Recipe has been logged as a meal.');
    }
  };

  const handleDeleteRecipe = (recipeId: string, name: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${name}"?`)) deleteRecipe(recipeId);
    } else {
      crossPlatformAlert('Delete Recipe', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRecipe(recipeId) },
      ]);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedRecipeId(expandedRecipeId === id ? null : id);
  };

  const handleAddToGrocery = useCallback((recipe: RecipeEntry) => {
    // Build grocery items from structured ingredient data.
    // Use ingredientsList strings if present; fall back to items with quantity+unit.
    let groceryItems;
    if (recipe.ingredientsList && recipe.ingredientsList.length > 0) {
      // ingredientsList strings already encode quantity (e.g. "2 lbs chicken breast")
      groceryItems = recipe.ingredientsList.map((line) => ({
        name: line,
        quantity: '',
        checked: false,
      }));
    } else {
      groceryItems = recipe.items.map((item) => ({
        name: item.name,
        quantity: `${item.quantity} ${item.unit}`.trim(),
        checked: false,
      }));
    }
    if (groceryItems.length === 0) {
      crossPlatformAlert('No ingredients', 'This recipe has no ingredient data to add.');
      return;
    }
    mergeRecipeItems(recipe.name, groceryItems);
    crossPlatformAlert('Added', `${groceryItems.length} ingredient${groceryItems.length !== 1 ? 's' : ''} added to your grocery list.`);
  }, [mergeRecipeItems]);

  // ── Render: AI Generate View ───────────────────────────────────────

  const renderAIGenerateView = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Card style={{ marginBottom: spacing.base }}>
        <View style={[styles.aiHeader, { marginBottom: spacing.md }]}>
          <Ionicons name="sparkles" size={22} color="#8B5CF6" />
          <Text style={[typography.h3, { color: colors.text, marginLeft: spacing.sm }]}>
            AI Recipe Generator
          </Text>
        </View>

        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
          {fromGrocery && useGroceries
            ? 'Describe what you\'d like to cook and the AI will create a recipe using your grocery list ingredients.'
            : 'Describe what you\'d like to eat and the AI will create a recipe tailored to your goals, allergies, and cooking setup.'}
        </Text>

        <TextInput
          style={[
            styles.aiPromptInput,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.md,
              color: colors.text,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              ...typography.body,
              marginBottom: spacing.md,
            },
          ]}
          placeholder='e.g. "a high-protein lunch under 500 calories" or "something quick with chicken and rice"'
          placeholderTextColor={colors.textTertiary}
          value={aiPrompt}
          onChangeText={setAiPrompt}
          multiline
          numberOfLines={3}
          editable={!isGenerating}
        />

        {/* Grocery list toggle — only when unchecked items exist */}
        {uncheckedGroceryCount > 0 && (
          <View style={[styles.groceryToggle, { marginBottom: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.label, { color: colors.text }]}>
                Use my grocery list
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {uncheckedGroceryCount} ingredient{uncheckedGroceryCount !== 1 ? 's' : ''} available
              </Text>
            </View>
            <Switch
              value={useGroceries}
              onValueChange={setUseGroceries}
              disabled={isGenerating}
              trackColor={{ true: '#8B5CF6' }}
            />
          </View>
        )}

        {/* Quick suggestion chips */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
          Quick ideas:
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md, flexGrow: 0 }}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          {[
            'High-protein breakfast',
            'Quick lunch under 400 cal',
            'Post-workout meal',
            'Low-carb dinner',
            'Healthy snack',
            'Meal prep friendly',
          ].map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              onPress={() => !isGenerating && setAiPrompt(suggestion)}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {aiError && (
          <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md }]}>
            <Text style={[typography.bodySmall, { color: '#B91C1C' }]}>{aiError}</Text>
          </View>
        )}
      </Card>

      <View style={{ gap: spacing.sm, marginBottom: spacing['2xl'] }}>
        <Button
          title={isGenerating ? 'Generating...' : 'Generate Recipe'}
          onPress={handleAIGenerate}
          disabled={!aiPrompt.trim() || isGenerating}
          loading={isGenerating}
        />
        <Button
          title="Cancel"
          variant="ghost"
          onPress={() => {
            if (fromGrocery) {
              router.back();
            } else {
              setShowAIGenerate(false);
              setAiPrompt('');
              setAiError(null);
            }
          }}
          disabled={isGenerating}
        />
      </View>
    </ScrollView>
  );

  // ── Render: Manual Create View ─────────────────────────────────────

  const renderManualCreateView = () => (
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

      <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>Ingredients</Text>

      {items.map((item) => (
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
            <View style={styles.macroItem}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Qty</Text>
              <TextInput
                style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                value={String(item.quantity || '')}
                onChangeText={(v) => setItems(items.map((i) => i.id === item.id ? { ...i, quantity: parseFloat(v) || 0 } : i))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.macroItem}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Unit</Text>
              <TextInput
                style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, color: colors.text, ...typography.label }]}
                value={item.unit}
                onChangeText={(v) => setItems(items.map((i) => i.id === item.id ? { ...i, unit: v } : i))}
                placeholder="serving"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
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
  );

  // ── Render: Recipe Card ────────────────────────────────────────────

  const renderRecipeCard = (recipe: RecipeEntry) => {
    const cal = recipe.calories ?? calculateMealTotals(recipe.items).calories;
    const pro = recipe.protein_g ?? calculateMealTotals(recipe.items).protein_g;
    const carb = recipe.carbs_g ?? calculateMealTotals(recipe.items).carbs_g;
    const fat = recipe.fat_g ?? calculateMealTotals(recipe.items).fat_g;
    const sourceInfo = SOURCE_LABELS[recipe.source ?? 'user'];
    const isSeed = recipe.source === 'seed';
    const isExpanded = expandedRecipeId === recipe.id;

    return (
      <TouchableOpacity
        key={recipe.id}
        activeOpacity={0.7}
        onPress={() => toggleExpanded(recipe.id)}
        onLongPress={() => !isSeed && handleDeleteRecipe(recipe.id, recipe.name)}
      >
        <Card style={{ marginBottom: spacing.sm }}>
          {/* Header row */}
          <View style={styles.recipeRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text
                  style={[typography.labelLarge, { color: colors.text, flex: 1 }]}
                  numberOfLines={isExpanded ? undefined : 1}
                >
                  {recipe.name}
                </Text>
                {recipe.difficulty && (
                  <View style={[
                    styles.difficultyBadge,
                    {
                      backgroundColor: DIFFICULTY_COLORS[recipe.difficulty] + '20',
                      borderRadius: radius.sm,
                      paddingHorizontal: spacing.xs,
                      paddingVertical: 2,
                      marginLeft: spacing.xs,
                    },
                  ]}>
                    <Text style={[
                      typography.caption,
                      { color: DIFFICULTY_COLORS[recipe.difficulty], fontWeight: '600' },
                    ]}>
                      {recipe.difficulty}
                    </Text>
                  </View>
                )}
              </View>

              {/* Source badge */}
              {sourceInfo && (
                <View style={[styles.sourceBadge, { marginTop: 3 }]}>
                  <Ionicons name={sourceInfo.icon as any} size={11} color={sourceInfo.color} />
                  <Text style={[typography.caption, { color: sourceInfo.color, marginLeft: 3, fontWeight: '500' }]}>
                    {sourceInfo.label}
                  </Text>
                </View>
              )}

              {/* Equipment */}
              {recipe.equipment && recipe.equipment.length > 0 && (
                <View style={[styles.equipmentRow, { marginTop: 3 }]}>
                  <Ionicons name="construct-outline" size={11} color={colors.textTertiary} />
                  <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 4 }]}>
                    {recipe.equipment.join(', ')}
                  </Text>
                </View>
              )}

              {/* Macros */}
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 3 }]}>
                {Math.round(cal)} cal · P: {Math.round(pro)}g · C: {Math.round(carb)}g · F: {Math.round(fat)}g
              </Text>
            </View>

            <View style={{ alignItems: 'center', gap: 4 }}>
              <Button
                title="Log"
                size="sm"
                fullWidth={false}
                onPress={() => handleLogRecipe(recipe.id)}
              />
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textTertiary}
              />
            </View>
          </View>

          {/* Expanded details */}
          {isExpanded && (
            <View style={[styles.expandedSection, { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }]}>
              {recipe.description ? (
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                  {recipe.description}
                </Text>
              ) : null}

              {/* Ingredients list */}
              {recipe.ingredientsList && recipe.ingredientsList.length > 0 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Ingredients</Text>
                  {recipe.ingredientsList.map((ing, idx) => (
                    <Text key={idx} style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      • {ing}
                    </Text>
                  ))}
                </View>
              )}

              {/* Instructions */}
              {recipe.instructions && recipe.instructions.length > 0 && (
                <View style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Instructions</Text>
                  {recipe.instructions.map((step, idx) => (
                    <Text key={idx} style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 2 }]}>
                      {idx + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}

              {/* Per-ingredient macros */}
              {recipe.items.length > 1 && (
                <View>
                  <Text style={[typography.label, { color: colors.text, marginBottom: 4 }]}>Nutrition Breakdown</Text>
                  {recipe.items.map((item) => (
                    <Text key={item.id} style={[typography.caption, { color: colors.textTertiary }]}>
                      {item.name}: {Math.round(item.calories)} cal · P: {Math.round(item.protein_g)}g · C: {Math.round(item.carbs_g)}g · F: {Math.round(item.fat_g)}g
                    </Text>
                  ))}
                </View>
              )}

              {/* Add ingredients to grocery list */}
              <View style={{ marginTop: spacing.md }}>
                <Button
                  title="Add to Grocery List"
                  variant="secondary"
                  size="sm"
                  onPress={() => handleAddToGrocery(recipe)}
                  icon={<Ionicons name="cart-outline" size={16} color={colors.primary} />}
                />
              </View>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  // ── Render: Main List View ─────────────────────────────────────────

  const isCreateMode = showCreate || showAIGenerate;

  return (
    <ScreenContainer scrollable={!isCreateMode}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => {
          if (isCreateMode) {
            // If the user arrived from the grocery list and is still in the AI view,
            // go straight back to the grocery list instead of dropping to recipe list.
            if (fromGrocery && showAIGenerate) {
              router.back();
              return;
            }
            setShowCreate(false);
            setShowAIGenerate(false);
            setItems([]);
            setAiPrompt('');
            setAiError(null);
          } else {
            router.back();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          {showAIGenerate ? 'AI Recipe' : showCreate ? 'Create Recipe' : 'Recipes'}
        </Text>
        {!isCreateMode && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => setShowAIGenerate(true)}>
              <Ionicons name="sparkles-outline" size={24} color="#8B5CF6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(true)}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showAIGenerate ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {renderAIGenerateView()}
        </KeyboardAvoidingView>
      ) : showCreate ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {renderManualCreateView()}
        </KeyboardAvoidingView>
      ) : (
        <>
          {/* Search bar */}
          <View style={{ marginBottom: spacing.sm }}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.xl,
                  color: colors.text,
                  paddingHorizontal: spacing.base,
                  ...typography.body,
                },
              ]}
              placeholder="Search recipes..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md, flexGrow: 0 }}
            contentContainerStyle={{ gap: spacing.xs }}
          >
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt;
              const chipColor = opt === 'AI' ? '#8B5CF6' : colors.primary;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setActiveFilter(opt)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? chipColor : colors.surfaceSecondary,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {opt === 'AI' && <Ionicons name="sparkles" size={12} color={isActive ? '#fff' : '#8B5CF6'} />}
                    <Text style={[typography.label, { color: isActive ? '#fff' : colors.textSecondary }]}>
                      {opt}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredRecipes.length === 0 ? (
            <EmptyState
              icon={activeFilter === 'AI' ? 'sparkles-outline' : 'book-outline'}
              title={activeFilter === 'AI' ? 'No AI Recipes Yet' : activeFilter === 'My Recipes' ? 'No Custom Recipes' : 'No Recipes Found'}
              description={activeFilter === 'AI'
                ? 'Generate a recipe with AI — it will be tailored to your goals and preferences.'
                : activeFilter === 'My Recipes'
                  ? 'Create your own recipes to quickly log meals with known macros.'
                  : 'Try a different filter or search term.'}
              actionLabel={activeFilter === 'AI' ? 'Generate with AI' : 'Create Recipe'}
              onAction={() => activeFilter === 'AI' ? setShowAIGenerate(true) : setShowCreate(true)}
            />
          ) : (
            <View style={{ marginBottom: spacing['2xl'] }}>
              {filteredRecipes.map((recipe) => renderRecipeCard(recipe))}

              <View style={[styles.hint, { marginTop: spacing.md }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: spacing.xs }]}>
                  Tap to expand · Long press custom/AI recipes to delete
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
  aiPromptInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groceryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBox: {},
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
  },
  macroField: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 32,
    marginTop: 2,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  difficultyBadge: {},
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedSection: {},
  chip: {},
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
