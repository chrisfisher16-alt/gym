import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { Card, Button, ScreenContainer } from '../../src/components/ui';
import { generateDefaultTargets } from '../../src/lib/nutrition-utils';
import {
  MACRO_SPLIT_PRESETS,
  type MacroSplitPreset,
  type NutritionTargets,
} from '../../src/types/nutrition';

const PRESET_INFO: Record<string, { label: string; description: string }> = {
  balanced: { label: 'Balanced', description: '30% Protein / 40% Carbs / 30% Fat' },
  high_protein: { label: 'High Protein', description: '40% Protein / 30% Carbs / 30% Fat' },
  low_carb: { label: 'Low Carb', description: '35% Protein / 25% Carbs / 40% Fat' },
  keto: { label: 'Keto', description: '35% Protein / 5% Carbs / 60% Fat' },
  custom: { label: 'Custom', description: 'Set your own values' },
};

export default function TargetsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const targets = useNutritionStore((s) => s.targets);
  const setDailyTargets = useNutritionStore((s) => s.setDailyTargets);

  const [calories, setCalories] = useState(String(targets.calories));
  const [protein, setProtein] = useState(String(targets.protein_g));
  const [carbs, setCarbs] = useState(String(targets.carbs_g));
  const [fat, setFat] = useState(String(targets.fat_g));
  const [fiber, setFiber] = useState(String(targets.fiber_g));
  const [water, setWater] = useState(String(targets.water_ml));
  const [selectedPreset, setSelectedPreset] = useState<MacroSplitPreset>('custom');

  const handlePreset = (preset: MacroSplitPreset) => {
    setSelectedPreset(preset);

    if (preset === 'custom') return;

    const split = MACRO_SPLIT_PRESETS[preset];
    const cal = parseInt(calories) || 2200;

    // Recalculate macros based on calorie target and split
    const proteinG = Math.round((cal * split.protein_pct) / 100 / 4);
    const carbsG = Math.round((cal * split.carbs_pct) / 100 / 4);
    const fatG = Math.round((cal * split.fat_pct) / 100 / 9);

    setProtein(String(proteinG));
    setCarbs(String(carbsG));
    setFat(String(fatG));
  };

  const handleAutoCalculate = () => {
    const generated = generateDefaultTargets(
      { sex: 'male', age: 30, weight_kg: 80, height_cm: 178, activityLevel: 'moderate', goal: 'maintain' },
      MACRO_SPLIT_PRESETS.balanced,
    );

    setCalories(String(generated.calories));
    setProtein(String(generated.protein_g));
    setCarbs(String(generated.carbs_g));
    setFat(String(generated.fat_g));
    setFiber(String(generated.fiber_g));
    setWater(String(generated.water_ml));
    setSelectedPreset('balanced');
  };

  const handleSave = () => {
    const newTargets: NutritionTargets = {
      calories: parseInt(calories) || 2200,
      protein_g: parseInt(protein) || 150,
      carbs_g: parseInt(carbs) || 250,
      fat_g: parseInt(fat) || 70,
      fiber_g: parseInt(fiber) || 30,
      water_ml: parseInt(water) || 2500,
    };

    setDailyTargets(newTargets);
    router.back();
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Daily Targets
        </Text>
      </View>

      {/* Auto Calculate */}
      <TouchableOpacity
        style={[styles.autoCalc, { backgroundColor: colors.primaryMuted, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.lg }]}
        onPress={handleAutoCalculate}
        activeOpacity={0.7}
      >
        <Ionicons name="calculator-outline" size={20} color={colors.primary} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={[typography.label, { color: colors.primary }]}>Auto-Calculate from Profile</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Uses BMR/TDEE formula</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </TouchableOpacity>

      {/* Calories */}
      <Card style={{ marginBottom: spacing.base }}>
        <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
          Calorie Target
        </Text>
        <TextInput
          style={[styles.calorieInput, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.displayMedium }]}
          value={calories}
          onChangeText={(v) => {
            setCalories(v);
            // Recalculate macros if preset selected
            if (selectedPreset !== 'custom') {
              const split = MACRO_SPLIT_PRESETS[selectedPreset as Exclude<MacroSplitPreset, 'custom'>];
              if (split) {
                const cal = parseInt(v) || 0;
                setProtein(String(Math.round((cal * split.protein_pct) / 100 / 4)));
                setCarbs(String(Math.round((cal * split.carbs_pct) / 100 / 4)));
                setFat(String(Math.round((cal * split.fat_pct) / 100 / 9)));
              }
            }
          }}
          keyboardType="numeric"
          placeholder="2200"
          placeholderTextColor={colors.textTertiary}
        />
      </Card>

      {/* Macro Split Presets */}
      <Card style={{ marginBottom: spacing.base }}>
        <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
          Macro Split
        </Text>

        {Object.entries(PRESET_INFO).map(([key, info]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.presetRow,
              {
                backgroundColor: selectedPreset === key ? colors.primaryMuted : 'transparent',
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.xs,
              },
            ]}
            onPress={() => handlePreset(key as MacroSplitPreset)}
          >
            <Ionicons
              name={selectedPreset === key ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={selectedPreset === key ? colors.primary : colors.textTertiary}
            />
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.label, { color: colors.text }]}>{info.label}</Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>{info.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Macro Grams */}
      <Card style={{ marginBottom: spacing.base }}>
        <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
          Daily Macros (grams)
        </Text>

        <View style={styles.macroInputs}>
          <View style={styles.macroCol}>
            <Text style={[typography.labelSmall, { color: colors.protein, marginBottom: spacing.xs }]}>
              Protein (g)
            </Text>
            <TextInput
              style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
              value={protein}
              onChangeText={(v) => { setProtein(v); setSelectedPreset('custom'); }}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.macroCol}>
            <Text style={[typography.labelSmall, { color: colors.carbs, marginBottom: spacing.xs }]}>
              Carbs (g)
            </Text>
            <TextInput
              style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
              value={carbs}
              onChangeText={(v) => { setCarbs(v); setSelectedPreset('custom'); }}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.macroCol}>
            <Text style={[typography.labelSmall, { color: colors.fat, marginBottom: spacing.xs }]}>
              Fat (g)
            </Text>
            <TextInput
              style={[styles.macroField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
              value={fat}
              onChangeText={(v) => { setFat(v); setSelectedPreset('custom'); }}
              keyboardType="numeric"
            />
          </View>
        </View>
      </Card>

      {/* Other Targets */}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.md }]}>
          Other Targets
        </Text>

        <View style={[styles.otherRow, { marginBottom: spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.fiber }]}>Fiber (g)</Text>
          </View>
          <TextInput
            style={[styles.smallField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
            value={fiber}
            onChangeText={setFiber}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.otherRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.info }]}>Water (ml)</Text>
          </View>
          <TextInput
            style={[styles.smallField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
            value={water}
            onChangeText={setWater}
            keyboardType="numeric"
          />
        </View>
      </Card>

      {/* Save */}
      <Button
        title="Save Targets"
        onPress={handleSave}
        style={{ marginBottom: spacing['2xl'] }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoCalc: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calorieInput: {
    textAlign: 'center',
    paddingVertical: 12,
    minHeight: 56,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCol: {
    flex: 1,
  },
  macroField: {
    textAlign: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallField: {
    width: 100,
    textAlign: 'center',
    paddingVertical: 8,
    minHeight: 40,
  },
});
