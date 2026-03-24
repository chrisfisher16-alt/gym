import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { useNutritionStore } from '../stores/nutrition-store';
import { analyzeMealText, analyzePhotoMeal } from '../lib/ai-meal-analyzer';
import { crossPlatformAlert } from '../lib/cross-platform-alert';
import type { MealType } from '../types/nutrition';
import { successNotification } from '../lib/haptics';

// ── Types ───────────────────────────────────────────────────────────────

interface QuickLogMealSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ── Meal type options ───────────────────────────────────────────────────

const MEAL_TYPES: { key: MealType; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { key: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { key: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

function getDefaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
}

// ── Component ───────────────────────────────────────────────────────────

export function QuickLogMealSheet({ visible, onClose }: QuickLogMealSheetProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const [mealType, setMealType] = useState<MealType>(getDefaultMealType);
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      setMealType(getDefaultMealType());
      setFoodName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setAnalyzing(false);
    }
  }, [visible]);

  const canSubmit = foodName.trim().length > 0 && calories.trim().length > 0 && !analyzing;

  // ── AI text analysis ──────────────────────────────────────────────────

  const handleAIAnalyze = useCallback(async () => {
    const desc = foodName.trim();
    if (!desc) return;

    setAnalyzing(true);
    try {
      const items = await analyzeMealText(desc);
      if (items.length > 0) {
        // Sum up totals across all returned items
        let totalCal = 0, totalPro = 0, totalCarbs = 0, totalFat = 0;
        const names: string[] = [];
        for (const item of items) {
          totalCal += item.calories;
          totalPro += item.protein_g;
          totalCarbs += item.carbs_g;
          totalFat += item.fat_g;
          names.push(item.name);
        }
        // If we got a richer name from AI and user typed a vague description, update
        if (items.length === 1 && items[0].name !== 'Unknown Item') {
          setFoodName(items[0].name);
        }
        setCalories(String(Math.round(totalCal)));
        setProtein(String(Math.round(totalPro)));
        setCarbs(String(Math.round(totalCarbs)));
        setFat(String(Math.round(totalFat)));
      }
    } catch (err) {
      console.error('AI analyze error:', err);
      crossPlatformAlert('Analysis Failed', 'Could not analyze the meal description. Please enter values manually.');
    } finally {
      setAnalyzing(false);
    }
  }, [foodName]);

  // ── Photo capture & analysis ──────────────────────────────────────────

  const handlePhotoCapture = useCallback(async () => {
    try {
      const ImagePicker = await import('expo-image-picker');

      let result;
      if (Platform.OS === 'web') {
        // Web doesn't support camera — use media library
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          crossPlatformAlert('Permission Needed', 'Please grant photo library access to use this feature.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          crossPlatformAlert('Permission Needed', 'Please grant camera access to use this feature.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets[0]) return;

      const uri = result.assets[0].uri;
      setAnalyzing(true);

      const items = await analyzePhotoMeal(uri);
      if (items.length > 0) {
        let totalCal = 0, totalPro = 0, totalCarbs = 0, totalFat = 0;
        const names: string[] = [];
        for (const item of items) {
          totalCal += item.calories;
          totalPro += item.protein_g;
          totalCarbs += item.carbs_g;
          totalFat += item.fat_g;
          names.push(item.name);
        }
        setFoodName(names.join(', '));
        setCalories(String(Math.round(totalCal)));
        setProtein(String(Math.round(totalPro)));
        setCarbs(String(Math.round(totalCarbs)));
        setFat(String(Math.round(totalFat)));
      }
    } catch (err) {
      console.error('Photo capture/analysis error:', err);
      crossPlatformAlert('Analysis Failed', 'Could not analyze the photo. Please enter values manually.');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    useNutritionStore.getState().logMeal({
      mealType,
      name: foodName.trim(),
      source: 'manual' as const,
      timestamp: new Date().toISOString(),
      items: [
        {
          id: `quick_${Date.now()}`,
          name: foodName.trim(),
          calories: parseInt(calories, 10) || 0,
          protein_g: parseInt(protein, 10) || 0,
          carbs_g: parseInt(carbs, 10) || 0,
          fat_g: parseInt(fat, 10) || 0,
          fiber_g: 0,
          quantity: 1,
          unit: 'serving',
          is_estimate: true,
        },
      ],
    });

    successNotification();
    onClose();
  }, [canSubmit, mealType, foodName, calories, protein, carbs, fat, onClose]);

  if (!visible) return null;

  // ── Shared input style ────────────────────────────────────────────────

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      borderColor: colors.border,
      color: colors.text,
      ...typography.body,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.75}>
      {/* Title */}
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.lg }]}>
        Quick Log Meal
      </Text>

      {/* Meal type selector */}
      <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
        Meal type
      </Text>
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((mt) => {
          const isSelected = mealType === mt.key;
          return (
            <TouchableOpacity
              key={mt.key}
              onPress={() => setMealType(mt.key)}
              style={[
                styles.mealTypePill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={mt.label}
              accessibilityState={{ selected: isSelected }}
            >
              <Ionicons
                name={mt.icon as any}
                size={14}
                color={isSelected ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  typography.labelSmall,
                  {
                    color: isSelected ? colors.textInverse : colors.text,
                    marginLeft: 4,
                  },
                ]}
              >
                {mt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Food name input with AI & camera buttons */}
      <View style={[styles.foodNameRow, { marginTop: spacing.lg }]}>
        <TextInput
          style={[inputStyle, styles.foodNameInput]}
          placeholder="What did you eat?"
          placeholderTextColor={colors.textTertiary}
          value={foodName}
          onChangeText={setFoodName}
          returnKeyType="next"
          editable={!analyzing}
        />
        <TouchableOpacity
          onPress={handleAIAnalyze}
          disabled={analyzing || foodName.trim().length === 0}
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              opacity: analyzing || foodName.trim().length === 0 ? 0.5 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="AI Analyze"
        >
          {analyzing ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Ionicons name="sparkles" size={18} color={colors.textOnPrimary} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePhotoCapture}
          disabled={analyzing}
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: analyzing ? 0.5 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <Ionicons name="camera-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Loading indicator */}
      {analyzing && (
        <View style={[styles.analyzingRow, { marginTop: spacing.sm }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[typography.labelSmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
            Analyzing with AI…
          </Text>
        </View>
      )}

      {/* Calories input */}
      <TextInput
        style={[inputStyle, { marginTop: spacing.sm }]}
        placeholder="Estimated calories"
        placeholderTextColor={colors.textTertiary}
        value={calories}
        onChangeText={setCalories}
        keyboardType="numeric"
        returnKeyType="next"
        editable={!analyzing}
      />

      {/* Protein input */}
      <TextInput
        style={[inputStyle, { marginTop: spacing.sm }]}
        placeholder="Protein (g) — optional"
        placeholderTextColor={colors.textTertiary}
        value={protein}
        onChangeText={setProtein}
        keyboardType="numeric"
        returnKeyType="next"
        editable={!analyzing}
      />

      {/* Carbs & Fat row */}
      <View style={[styles.macroRow, { marginTop: spacing.sm }]}>
        <TextInput
          style={[inputStyle, styles.halfInput]}
          placeholder="Carbs (g)"
          placeholderTextColor={colors.textTertiary}
          value={carbs}
          onChangeText={setCarbs}
          keyboardType="numeric"
          returnKeyType="next"
          editable={!analyzing}
        />
        <TextInput
          style={[inputStyle, styles.halfInput]}
          placeholder="Fat (g)"
          placeholderTextColor={colors.textTertiary}
          value={fat}
          onChangeText={setFat}
          keyboardType="numeric"
          returnKeyType="done"
          editable={!analyzing}
        />
      </View>

      {/* Submit button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={[
          styles.submitButton,
          {
            backgroundColor: canSubmit ? colors.primary : colors.disabled,
            borderRadius: radius.md,
            paddingVertical: spacing.base,
            marginTop: spacing.lg,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Log meal"
        accessibilityState={{ disabled: !canSubmit }}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={canSubmit ? colors.textOnPrimary : colors.disabledText}
          style={{ marginRight: spacing.sm }}
        />
        <Text
          style={[
            typography.labelLarge,
            { color: canSubmit ? colors.textOnPrimary : colors.disabledText },
          ]}
        >
          Log Meal
        </Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foodNameInput: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
