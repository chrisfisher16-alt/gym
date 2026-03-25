import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useNutritionStore } from '../../src/stores/nutrition-store';
import { useProfileStore } from '../../src/stores/profile-store';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { calculateNutritionTargets } from '../../src/lib/nutrition-calculator';
import { Card, Button, ScreenContainer, BottomSheet } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
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

  const profileGender = useProfileStore((s) => s.profile.gender);
  const profileHeight = useProfileStore((s) => s.profile.heightCm);
  const profileWeight = useProfileStore((s) => s.profile.weightKg);
  const profileDob = useProfileStore((s) => s.profile.dateOfBirth);
  const profileTrainingDays = useProfileStore((s) => s.profile.trainingDaysPerWeek);

  const onboardingGender = useOnboardingStore((s) => s.gender);
  const onboardingHeight = useOnboardingStore((s) => s.heightCm);
  const onboardingWeight = useOnboardingStore((s) => s.weightKg);
  const onboardingDob = useOnboardingStore((s) => s.dateOfBirth);
  const onboardingGoal = useOnboardingStore((s) => s.fitnessGoal);
  const onboardingTrainingDays = useOnboardingStore((s) => s.trainingDaysPerWeek);

  const [calories, setCalories] = useState(String(targets.calories));
  const [protein, setProtein] = useState(String(targets.protein_g));
  const [carbs, setCarbs] = useState(String(targets.carbs_g));
  const [fat, setFat] = useState(String(targets.fat_g));
  const [fiber, setFiber] = useState(String(targets.fiber_g));
  const [water, setWater] = useState(String(targets.water_oz));
  const [selectedPreset, setSelectedPreset] = useState<MacroSplitPreset>('custom');
  const [showCalcSheet, setShowCalcSheet] = useState(false);
  const [calcBreakdown, setCalcBreakdown] = useState<{
    gender: string;
    age: number;
    weightKg: number;
    heightCm: number;
    trainingDays: number;
    goal: string;
    bmr: number;
    tdee: number;
    adjustment: number;
    targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; water_oz: number };
  } | null>(null);

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
    // Resolve profile data (profile store → onboarding store → defaults)
    const gender = profileGender || onboardingGender || 'male';
    const heightCm = profileHeight || onboardingHeight || 175;
    const weightKg = profileWeight || onboardingWeight || 75;
    const trainingDays = profileTrainingDays || onboardingTrainingDays || 3;
    const goal = onboardingGoal || 'stay_active';

    // Calculate age from date of birth
    const dob = profileDob || onboardingDob;
    let age = 30; // default
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Calculate using the sophisticated calculator
    const targets = calculateNutritionTargets({
      weightKg,
      heightCm,
      ageYears: age,
      gender,
      fitnessGoal: goal,
      trainingDaysPerWeek: trainingDays,
    });

    // Calculate intermediate values for the breakdown
    const bmr = Math.round(gender === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5);
    
    let multiplier = 1.55;
    if (trainingDays <= 2) multiplier = 1.375;
    else if (trainingDays > 4) multiplier = 1.725;
    const tdee = Math.round(bmr * multiplier);

    let adjustment = 0;
    if (goal === 'build_muscle') adjustment = 300;
    else if (goal === 'lose_fat') adjustment = -500;
    else if (goal === 'get_stronger') adjustment = 200;

    setCalcBreakdown({
      gender,
      age,
      weightKg,
      heightCm,
      trainingDays,
      goal,
      bmr,
      tdee,
      adjustment,
      targets,
    });
    setShowCalcSheet(true);
  };

  const handleApplyCalculated = () => {
    if (!calcBreakdown) return;
    const { targets: t } = calcBreakdown;
    setCalories(String(t.calories));
    setProtein(String(t.protein_g));
    setCarbs(String(t.carbs_g));
    setFat(String(t.fat_g));
    setFiber(String(t.fiber_g));
    setWater(String(t.water_oz));
    setSelectedPreset('custom');
    setShowCalcSheet(false);
  };

  const { showToast } = useToast();

  const handleSave = () => {
    const parsedCalories = Math.max(0, parseInt(calories) || 0);
    const parsedProtein = Math.max(0, parseInt(protein) || 0);
    const parsedCarbs = Math.max(0, parseInt(carbs) || 0);
    const parsedFat = Math.max(0, parseInt(fat) || 0);
    const parsedFiber = Math.max(0, parseInt(fiber) || 0);
    const parsedWater = Math.max(0, parseInt(water) || 0);

    const usedDefaults = !parsedCalories || !parsedProtein || !parsedCarbs || !parsedFat || !parsedFiber || !parsedWater;

    const newTargets: NutritionTargets = {
      calories: parsedCalories || 2200,
      protein_g: parsedProtein || 150,
      carbs_g: parsedCarbs || 250,
      fat_g: parsedFat || 70,
      fiber_g: parsedFiber || 30,
      water_oz: parsedWater || 85,
    };

    setDailyTargets(newTargets);
    if (usedDefaults) {
      showToast('Default targets applied', 'info', 2000);
    }
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
            const n = parseInt(v);
            const safe = v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n));
            setCalories(safe);
            // Recalculate macros if preset selected
            if (selectedPreset !== 'custom') {
              const split = MACRO_SPLIT_PRESETS[selectedPreset as Exclude<MacroSplitPreset, 'custom'>];
              if (split) {
                const cal = Math.max(0, parseInt(safe) || 0);
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
              onChangeText={(v) => { const n = parseInt(v); setProtein(v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n))); setSelectedPreset('custom'); }}
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
              onChangeText={(v) => { const n = parseInt(v); setCarbs(v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n))); setSelectedPreset('custom'); }}
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
              onChangeText={(v) => { const n = parseInt(v); setFat(v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n))); setSelectedPreset('custom'); }}
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
            onChangeText={(v) => { const n = parseInt(v); setFiber(v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n))); }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.otherRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.info }]}>Water (oz)</Text>
          </View>
          <TextInput
            style={[styles.smallField, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, color: colors.text, ...typography.label }]}
            value={water}
            onChangeText={(v) => { const n = parseInt(v); setWater(v === '' ? '' : isNaN(n) ? '' : String(Math.max(0, n))); }}
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

      {/* Calculation Breakdown Sheet */}
      <BottomSheet visible={showCalcSheet} onClose={() => setShowCalcSheet(false)} maxHeight={0.85}>
        <ScrollView style={{ padding: spacing.base }}>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.base }]}>
            Calculation Breakdown
          </Text>

          {calcBreakdown && (
            <>
              {/* Profile Data Used */}
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
                  Your Profile
                </Text>
                <View style={{ gap: 4 }}>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>
                    {calcBreakdown.gender === 'female' ? 'Female' : 'Male'}, {calcBreakdown.age} years old
                  </Text>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>
                    {calcBreakdown.heightCm} cm · {calcBreakdown.weightKg} kg ({Math.round(calcBreakdown.weightKg * 2.205)} lbs)
                  </Text>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>
                    Training {calcBreakdown.trainingDays} days/week
                  </Text>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>
                    Goal: {calcBreakdown.goal.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                </View>
              </Card>

              {/* Step 1: BMR */}
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[typography.labelSmall, { color: colors.primary }]}>1</Text>
                  </View>
                  <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                    Basal Metabolic Rate (BMR)
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                  Mifflin-St Jeor equation — calories your body burns at rest
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textTertiary, fontStyle: 'italic', marginBottom: spacing.sm }]}>
                  {calcBreakdown.gender === 'female' 
                    ? `(10 × ${calcBreakdown.weightKg}kg) + (6.25 × ${calcBreakdown.heightCm}cm) - (5 × ${calcBreakdown.age}) - 161`
                    : `(10 × ${calcBreakdown.weightKg}kg) + (6.25 × ${calcBreakdown.heightCm}cm) - (5 × ${calcBreakdown.age}) + 5`}
                </Text>
                <Text style={[typography.h2, { color: colors.primary }]}>
                  BMR = {calcBreakdown.bmr.toLocaleString()} cal/day
                </Text>
              </Card>

              {/* Step 2: TDEE */}
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[typography.labelSmall, { color: colors.primary }]}>2</Text>
                  </View>
                  <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                    Total Daily Energy Expenditure
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                  BMR × activity multiplier ({calcBreakdown.trainingDays <= 2 ? '1.375 — lightly active' : calcBreakdown.trainingDays <= 4 ? '1.55 — moderately active' : '1.725 — very active'})
                </Text>
                <Text style={[typography.h2, { color: colors.primary }]}>
                  TDEE = {calcBreakdown.tdee.toLocaleString()} cal/day
                </Text>
              </Card>

              {/* Step 3: Goal Adjustment */}
              {calcBreakdown.adjustment !== 0 && (
                <Card style={{ marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={[typography.labelSmall, { color: colors.primary }]}>3</Text>
                    </View>
                    <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                      Goal Adjustment
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    {calcBreakdown.adjustment > 0 
                      ? `+${calcBreakdown.adjustment} cal surplus for ${calcBreakdown.goal.replace(/_/g, ' ')}`
                      : `${calcBreakdown.adjustment} cal deficit for ${calcBreakdown.goal.replace(/_/g, ' ')}`}
                  </Text>
                  <Text style={[typography.h2, { color: colors.primary }]}>
                    {calcBreakdown.tdee.toLocaleString()} {calcBreakdown.adjustment > 0 ? '+' : ''} {calcBreakdown.adjustment} = {calcBreakdown.targets.calories.toLocaleString()} cal
                  </Text>
                </Card>
              )}

              {/* Final Targets */}
              <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primaryMuted }}>
                <Text style={[typography.label, { color: colors.primary, marginBottom: spacing.md }]}>
                  Recommended Daily Targets
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[typography.h2, { color: colors.text }]}>{calcBreakdown.targets.calories}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Calories</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[typography.label, { color: colors.protein }]}>{calcBreakdown.targets.protein_g}g</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Protein</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[typography.label, { color: colors.carbs }]}>{calcBreakdown.targets.carbs_g}g</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Carbs</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[typography.label, { color: colors.fat }]}>{calcBreakdown.targets.fat_g}g</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Fat</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[typography.label, { color: colors.fiber }]}>{calcBreakdown.targets.fiber_g}g</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Fiber</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[typography.label, { color: colors.info }]}>{calcBreakdown.targets.water_oz}oz</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>Water</Text>
                  </View>
                </View>
              </Card>

              {/* Apply Button */}
              <Button
                title="Apply These Targets"
                onPress={handleApplyCalculated}
                style={{ marginBottom: spacing.xl }}
              />
            </>
          )}
        </ScrollView>
      </BottomSheet>
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
