import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, Button, Input, ScreenContainer, Divider } from '../src/components/ui';
import {
  useProfileStore,
  type UserProfile,
  type HealthGoal,
  type CookingSkillLevel,
  type CookingEquipment,
  type DietaryPreference,
  type Weekday,
} from '../src/stores/profile-store';
import { useToast } from '../src/components/Toast';

// ── Constants ────────────────────────────────────────────────────────

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const HEALTH_GOAL_OPTIONS: { id: HealthGoal; label: string; icon: string }[] = [
  { id: 'lose_weight', label: 'Lose Weight', icon: 'trending-down-outline' },
  { id: 'gain_muscle', label: 'Gain Muscle', icon: 'barbell-outline' },
  { id: 'build_lean_muscle', label: 'Build Lean Muscle', icon: 'body-outline' },
  { id: 'improve_endurance', label: 'Improve Endurance', icon: 'heart-outline' },
  { id: 'maintain_weight', label: 'Maintain Weight', icon: 'scale-outline' },
  { id: 'improve_general_health', label: 'Improve General Health', icon: 'medkit-outline' },
];

const ACTIVITY_LEVELS = [
  { value: 1, label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 2, label: 'Light', desc: '1-2 days/week' },
  { value: 3, label: 'Moderate', desc: '3-4 days/week' },
  { value: 4, label: 'Active', desc: '5-6 days/week' },
  { value: 5, label: 'Very Active', desc: 'Daily intense exercise' },
];

const EXPERIENCE_OPTIONS: { id: UserProfile['trainingExperience']; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: 'Less than 1 year' },
  { id: 'intermediate', label: 'Intermediate', desc: '1-3 years' },
  { id: 'advanced', label: 'Advanced', desc: '3+ years' },
];

const FITNESS_EQUIPMENT_OPTIONS = [
  'Full Gym',
  'Home Gym',
  'Dumbbells Only',
  'Bodyweight Only',
  'Resistance Bands',
  'Kettlebells',
  'Pull-up Bar',
];

const COOKING_EQUIPMENT_OPTIONS: { id: CookingEquipment; label: string; icon: string }[] = [
  { id: 'stove', label: 'Stove', icon: 'flame-outline' },
  { id: 'oven', label: 'Oven', icon: 'grid-outline' },
  { id: 'microwave', label: 'Microwave', icon: 'radio-outline' },
  { id: 'air_fryer', label: 'Air Fryer', icon: 'flash-outline' },
  { id: 'blender', label: 'Blender', icon: 'color-filter-outline' },
  { id: 'slow_cooker', label: 'Slow Cooker', icon: 'time-outline' },
  { id: 'instant_pot', label: 'Instant Pot', icon: 'speedometer-outline' },
  { id: 'grill', label: 'Grill', icon: 'bonfire-outline' },
  { id: 'no_kitchen', label: 'No Kitchen / Premade Only', icon: 'bag-handle-outline' },
];

const COOKING_SKILL_OPTIONS: { id: CookingSkillLevel; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: 'Simple recipes, minimal prep' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Comfortable with most recipes' },
  { id: 'advanced', label: 'Advanced', desc: 'Complex techniques, any recipe' },
];

const DIETARY_PREFERENCE_OPTIONS: { id: DietaryPreference; label: string }[] = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'keto', label: 'Keto' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'gluten_free', label: 'Gluten Free' },
  { id: 'dairy_free', label: 'Dairy Free' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'low_carb', label: 'Low Carb' },
  { id: 'low_fat', label: 'Low Fat' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'whole30', label: 'Whole30' },
];

const WEEKDAY_OPTIONS: { id: Weekday; short: string; label: string }[] = [
  { id: 'monday', short: 'M', label: 'Monday' },
  { id: 'tuesday', short: 'T', label: 'Tuesday' },
  { id: 'wednesday', short: 'W', label: 'Wednesday' },
  { id: 'thursday', short: 'T', label: 'Thursday' },
  { id: 'friday', short: 'F', label: 'Friday' },
  { id: 'saturday', short: 'S', label: 'Saturday' },
  { id: 'sunday', short: 'S', label: 'Sunday' },
];

const COMMON_ALLERGIES = [
  'Peanuts',
  'Tree Nuts',
  'Dairy',
  'Eggs',
  'Wheat/Gluten',
  'Soy',
  'Shellfish',
  'Fish',
  'Sesame',
  'Corn',
];

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Varies'];

// ── Helpers ──────────────────────────────────────────────────────────

function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

// ── Component ────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const storedProfile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const { showToast } = useToast();

  // ── Local form state ──────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(storedProfile.displayName);
  const [dateOfBirth, setDateOfBirth] = useState(storedProfile.dateOfBirth ?? '');
  const [gender, setGender] = useState(storedProfile.gender ?? '');

  const [unitPreference, setUnitPreference] = useState(storedProfile.unitPreference);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCmStr, setHeightCmStr] = useState('');
  const [weightStr, setWeightStr] = useState('');
  const [targetWeightStr, setTargetWeightStr] = useState('');

  const [healthGoals, setHealthGoals] = useState<HealthGoal[]>(storedProfile.healthGoals ?? []);
  const [healthGoalDescription, setHealthGoalDescription] = useState(storedProfile.healthGoalDescription ?? '');

  const [activityLevel, setActivityLevel] = useState(storedProfile.activityLevel ?? 0);
  const [experience, setExperience] = useState(storedProfile.trainingExperience ?? '');
  const [fitnessEquipment, setFitnessEquipment] = useState<string[]>(storedProfile.fitnessEquipment ?? []);
  const [preferredTime, setPreferredTime] = useState(storedProfile.preferredTrainingTime ?? '');
  const [preferredWorkoutDays, setPreferredWorkoutDays] = useState<Weekday[]>(storedProfile.preferredWorkoutDays ?? []);
  const [injuries, setInjuries] = useState(storedProfile.injuriesOrLimitations ?? '');
  const [primaryGoal, setPrimaryGoal] = useState(storedProfile.primaryGoal ?? '');
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState(String(storedProfile.trainingDaysPerWeek ?? ''));

  const [allergies, setAllergies] = useState<string[]>(storedProfile.allergies ?? []);
  const [customAllergyInput, setCustomAllergyInput] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>(storedProfile.dietaryPreferences ?? []);
  const [cookingSkill, setCookingSkill] = useState<CookingSkillLevel | ''>(storedProfile.cookingSkillLevel ?? '');
  const [cookingEquipment, setCookingEquipment] = useState<CookingEquipment[]>(storedProfile.cookingEquipment ?? []);

  // Initialize display values from stored metric data
  useEffect(() => {
    if (storedProfile.heightCm) {
      if (unitPreference === 'imperial') {
        const { feet, inches } = cmToFeetInches(storedProfile.heightCm);
        setHeightFeet(String(feet));
        setHeightInches(String(inches));
      } else {
        setHeightCmStr(String(storedProfile.heightCm));
      }
    }
    if (storedProfile.weightKg) {
      setWeightStr(
        unitPreference === 'imperial'
          ? String(kgToLbs(storedProfile.weightKg))
          : String(storedProfile.weightKg),
      );
    }
    if (storedProfile.targetWeightKg) {
      setTargetWeightStr(
        unitPreference === 'imperial'
          ? String(kgToLbs(storedProfile.targetWeightKg))
          : String(storedProfile.targetWeightKg),
      );
    }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = () => {
    let heightCm: number | undefined;
    if (unitPreference === 'imperial') {
      const ft = parseFloat(heightFeet) || 0;
      const inches = parseFloat(heightInches) || 0;
      if (ft > 0 || inches > 0) heightCm = feetInchesToCm(ft, inches);
    } else {
      const val = parseFloat(heightCmStr);
      if (val > 0) heightCm = val;
    }

    let weightKg: number | undefined;
    const weightVal = parseFloat(weightStr);
    if (weightVal > 0) {
      weightKg = unitPreference === 'imperial' ? lbsToKg(weightVal) : weightVal;
    }

    let targetWeightKg: number | undefined;
    const targetVal = parseFloat(targetWeightStr);
    if (targetVal > 0) {
      targetWeightKg = unitPreference === 'imperial' ? lbsToKg(targetVal) : targetVal;
    }

    updateProfile({
      displayName,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      heightCm,
      weightKg,
      unitPreference,
      targetWeightKg,
      activityLevel: activityLevel > 0 ? activityLevel : undefined,
      trainingExperience: experience as UserProfile['trainingExperience'] || undefined,
      injuriesOrLimitations: injuries || undefined,
      fitnessEquipment,
      preferredTrainingTime: preferredTime || undefined,
      preferredWorkoutDays,
      healthGoals,
      primaryGoal: primaryGoal.trim() || undefined,
      healthGoalDescription: healthGoalDescription || undefined,
      trainingDaysPerWeek: parseInt(trainingDaysPerWeek) || undefined,
      allergies,
      dietaryPreferences,
      cookingSkillLevel: cookingSkill as CookingSkillLevel || undefined,
      cookingEquipment,
    });

    showToast('Profile saved successfully', 'success');
    router.back();
  };

  // ── Toggle helpers ────────────────────────────────────────────────
  const toggleHealthGoal = (goal: HealthGoal) => {
    setHealthGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const toggleFitnessEquipment = (item: string) => {
    setFitnessEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item],
    );
  };

  const toggleCookingEquipment = (item: CookingEquipment) => {
    if (item === 'no_kitchen') {
      setCookingEquipment((prev) =>
        prev.includes('no_kitchen') ? [] : ['no_kitchen'],
      );
      return;
    }
    setCookingEquipment((prev) => {
      const without = prev.filter((e) => e !== 'no_kitchen' && e !== item);
      return prev.includes(item) ? without : [...without, item];
    });
  };

  const toggleDietaryPreference = (pref: DietaryPreference) => {
    if (pref === 'no_preference') {
      setDietaryPreferences((prev) =>
        prev.includes('no_preference') ? [] : ['no_preference'],
      );
      return;
    }
    setDietaryPreferences((prev) => {
      const without = prev.filter((p) => p !== 'no_preference' && p !== pref);
      return prev.includes(pref) ? without : [...without, pref];
    });
  };

  const toggleWorkoutDay = (day: Weekday) => {
    setPreferredWorkoutDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const toggleAllergy = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy) ? prev.filter((a) => a !== allergy) : [...prev, allergy],
    );
  };

  const addCustomAllergy = () => {
    const trimmed = customAllergyInput.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed]);
    }
    setCustomAllergyInput('');
  };

  // ── Shared sub-components ──────────────────────────────────────────

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
      <Text
        style={[
          typography.labelSmall,
          {
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 1,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const OptionChip = ({
    label,
    selected,
    onPress,
    icon,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    icon?: string;
  }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryMuted : colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={16}
          color={selected ? colors.primary : colors.textSecondary}
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          typography.bodySmall,
          { color: selected ? colors.primary : colors.text, fontWeight: selected ? '600' : '400' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <ScreenContainer edges={[]}>
      {/* ── Basic Info ─────────────────────────────────────────── */}
      <SectionHeader title="Basic Info" />
      <Card>
        <View style={{ gap: spacing.base }}>
          <Input
            label="Display Name"
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            leftIcon="person-outline"
          />
          <Input
            label="Date of Birth"
            placeholder="YYYY-MM-DD"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            leftIcon="calendar-outline"
          />
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Gender
            </Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <OptionChip
                  key={g}
                  label={g}
                  selected={gender === g}
                  onPress={() => setGender(gender === g ? '' : g)}
                />
              ))}
            </View>
          </View>
        </View>
      </Card>

      {/* ── Health Goals ──────────────────────────────────────── */}
      <SectionHeader
        title="Health Goals"
        subtitle="What are you looking to achieve?"
      />
      <Card>
        <View style={{ gap: spacing.base }}>
          <View style={styles.chipRow}>
            {HEALTH_GOAL_OPTIONS.map((g) => (
              <OptionChip
                key={g.id}
                label={g.label}
                icon={g.icon}
                selected={healthGoals.includes(g.id)}
                onPress={() => toggleHealthGoal(g.id)}
              />
            ))}
          </View>
          <Input
            label="Tell us more (optional)"
            placeholder="e.g. I want to lose 20 lbs and build lean muscle..."
            value={healthGoalDescription}
            onChangeText={setHealthGoalDescription}
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
          <Input
            label="Primary Goal (optional)"
            placeholder="e.g. Run a 5k, bench press 225 lbs..."
            value={primaryGoal}
            onChangeText={setPrimaryGoal}
          />
        </View>
      </Card>

      {/* ── Body Stats ────────────────────────────────────────── */}
      <SectionHeader title="Body Stats" />
      <Card>
        <View style={{ gap: spacing.base }}>
          {/* Unit toggle */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm }]}>
              Units
            </Text>
            <View
              style={[
                styles.unitToggle,
                { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
              ]}
            >
              {(['imperial', 'metric'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  onPress={() => {
                    if (unit === unitPreference) return;
                    if (unit === 'metric') {
                      const ft = parseFloat(heightFeet) || 0;
                      const inches = parseFloat(heightInches) || 0;
                      if (ft > 0 || inches > 0)
                        setHeightCmStr(String(feetInchesToCm(ft, inches)));
                      const w = parseFloat(weightStr);
                      if (w > 0) setWeightStr(String(lbsToKg(w)));
                      const tw = parseFloat(targetWeightStr);
                      if (tw > 0) setTargetWeightStr(String(lbsToKg(tw)));
                    } else {
                      const cm = parseFloat(heightCmStr) || 0;
                      if (cm > 0) {
                        const { feet, inches } = cmToFeetInches(cm);
                        setHeightFeet(String(feet));
                        setHeightInches(String(inches));
                      }
                      const w = parseFloat(weightStr);
                      if (w > 0) setWeightStr(String(kgToLbs(w)));
                      const tw = parseFloat(targetWeightStr);
                      if (tw > 0) setTargetWeightStr(String(kgToLbs(tw)));
                    }
                    setUnitPreference(unit);
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.unitOption,
                    {
                      backgroundColor:
                        unitPreference === unit ? colors.surface : 'transparent',
                      borderRadius: radius.sm,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      {
                        color:
                          unitPreference === unit ? colors.text : colors.textTertiary,
                      },
                    ]}
                  >
                    {unit === 'imperial' ? 'Imperial' : 'Metric'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Height */}
          {unitPreference === 'imperial' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Height (ft)"
                  placeholder="5"
                  keyboardType="numeric"
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Height (in)"
                  placeholder="10"
                  keyboardType="numeric"
                  value={heightInches}
                  onChangeText={setHeightInches}
                />
              </View>
            </View>
          ) : (
            <Input
              label="Height (cm)"
              placeholder="178"
              keyboardType="numeric"
              value={heightCmStr}
              onChangeText={setHeightCmStr}
            />
          )}

          {/* Weight */}
          <Input
            label={`Current Weight (${unitPreference === 'imperial' ? 'lbs' : 'kg'})`}
            placeholder={unitPreference === 'imperial' ? '165' : '75'}
            keyboardType="numeric"
            value={weightStr}
            onChangeText={setWeightStr}
          />
          <Input
            label={`Target Weight (${unitPreference === 'imperial' ? 'lbs' : 'kg'})`}
            placeholder={unitPreference === 'imperial' ? '155' : '70'}
            keyboardType="numeric"
            value={targetWeightStr}
            onChangeText={setTargetWeightStr}
          />
        </View>
      </Card>

      {/* ── Allergies & Dietary ─────────────────────────────── */}
      <SectionHeader
        title="Allergies"
        subtitle="Strictly excluded from all AI meal & grocery suggestions"
      />
      <Card>
        <View style={{ gap: spacing.base }}>
          <View style={styles.chipRow}>
            {COMMON_ALLERGIES.map((allergy) => (
              <OptionChip
                key={allergy}
                label={allergy}
                selected={allergies.includes(allergy)}
                onPress={() => toggleAllergy(allergy)}
              />
            ))}
          </View>

          {/* Custom allergies */}
          {allergies
            .filter((a) => !COMMON_ALLERGIES.includes(a))
            .map((custom) => (
              <View key={custom} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <OptionChip label={custom} selected={true} onPress={() => toggleAllergy(custom)} />
                <TouchableOpacity onPress={() => toggleAllergy(custom)}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Add custom allergy"
                placeholder="e.g. Mustard, Lupin..."
                value={customAllergyInput}
                onChangeText={setCustomAllergyInput}
                onSubmitEditing={addCustomAllergy}
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              onPress={addCustomAllergy}
              style={{
                backgroundColor: customAllergyInput.trim() ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: 2,
              }}
              disabled={!customAllergyInput.trim()}
            >
              <Ionicons name="add" size={22} color={customAllergyInput.trim() ? colors.textInverse : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      <SectionHeader
        title="Dietary Preferences"
        subtitle="Informs meal plans, recipes, and grocery lists"
      />
      <Card>
        <View style={styles.chipRow}>
          {DIETARY_PREFERENCE_OPTIONS.map((d) => (
            <OptionChip
              key={d.id}
              label={d.label}
              selected={dietaryPreferences.includes(d.id)}
              onPress={() => toggleDietaryPreference(d.id)}
            />
          ))}
        </View>
      </Card>

      {/* ── Cooking ──────────────────────────────────────────── */}
      <SectionHeader
        title="Cooking"
        subtitle="Helps tailor recipes and meal suggestions to your setup"
      />
      <Card>
        <View style={{ gap: spacing.base }}>
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Cooking Skill Level
            </Text>
            <View style={{ gap: spacing.sm }}>
              {COOKING_SKILL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.7}
                  onPress={() => setCookingSkill(cookingSkill === opt.id ? '' : opt.id)}
                  style={[
                    styles.listOption,
                    {
                      borderColor: cookingSkill === opt.id ? colors.primary : colors.border,
                      backgroundColor: cookingSkill === opt.id ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.label,
                        { color: cookingSkill === opt.id ? colors.primary : colors.text },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: cookingSkill === opt.id ? colors.primary : colors.textTertiary,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {opt.desc}
                    </Text>
                  </View>
                  {cookingSkill === opt.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Available Cooking Equipment
            </Text>
            <View style={styles.chipRow}>
              {COOKING_EQUIPMENT_OPTIONS.map((eq) => (
                <OptionChip
                  key={eq.id}
                  label={eq.label}
                  icon={eq.icon}
                  selected={cookingEquipment.includes(eq.id)}
                  onPress={() => toggleCookingEquipment(eq.id)}
                />
              ))}
            </View>
          </View>
        </View>
      </Card>

      {/* ── Fitness ──────────────────────────────────────────── */}
      <SectionHeader
        title="Fitness"
        subtitle="Helps personalize workout programs"
      />
      <Card>
        <View style={{ gap: spacing.base }}>
          {/* Activity Level */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Activity Level
            </Text>
            <View style={{ gap: spacing.sm }}>
              {ACTIVITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  activeOpacity={0.7}
                  onPress={() => setActivityLevel(level.value)}
                  style={[
                    styles.listOption,
                    {
                      borderColor: activityLevel === level.value ? colors.primary : colors.border,
                      backgroundColor: activityLevel === level.value ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.label,
                        { color: activityLevel === level.value ? colors.primary : colors.text },
                      ]}
                    >
                      {level.label}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: activityLevel === level.value ? colors.primary : colors.textTertiary,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {level.desc}
                    </Text>
                  </View>
                  {activityLevel === level.value && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          {/* Training Experience */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Training Experience
            </Text>
            <View style={{ gap: spacing.sm }}>
              {EXPERIENCE_OPTIONS.map((exp) => (
                <TouchableOpacity
                  key={exp.id}
                  activeOpacity={0.7}
                  onPress={() => setExperience(exp.id!)}
                  style={[
                    styles.listOption,
                    {
                      borderColor: experience === exp.id ? colors.primary : colors.border,
                      backgroundColor: experience === exp.id ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.label,
                        { color: experience === exp.id ? colors.primary : colors.text },
                      ]}
                    >
                      {exp.label}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: experience === exp.id ? colors.primary : colors.textTertiary,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {exp.desc}
                    </Text>
                  </View>
                  {experience === exp.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          {/* Preferred Workout Days */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Preferred Workout Days
            </Text>
            <View style={styles.chipRow}>
              {WEEKDAY_OPTIONS.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  activeOpacity={0.7}
                  onPress={() => toggleWorkoutDay(day.id)}
                  style={[
                    styles.dayChip,
                    {
                      borderColor: preferredWorkoutDays.includes(day.id) ? colors.primary : colors.border,
                      backgroundColor: preferredWorkoutDays.includes(day.id) ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      {
                        color: preferredWorkoutDays.includes(day.id) ? colors.primary : colors.text,
                        fontSize: 13,
                      },
                    ]}
                  >
                    {day.short}
                  </Text>
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: preferredWorkoutDays.includes(day.id) ? colors.primary : colors.textTertiary,
                        fontSize: 9,
                        marginTop: 1,
                      },
                    ]}
                  >
                    {day.label.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          {/* Training Days Per Week */}
          <View>
            <Input
              label="Training Days Per Week"
              placeholder="e.g. 4"
              keyboardType="numeric"
              value={trainingDaysPerWeek}
              onChangeText={setTrainingDaysPerWeek}
            />
          </View>

          <Divider />

          {/* Preferred training time */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Preferred Training Time
            </Text>
            <View style={styles.chipRow}>
              {TIME_OPTIONS.map((t) => (
                <OptionChip
                  key={t}
                  label={t}
                  selected={preferredTime === t}
                  onPress={() => setPreferredTime(preferredTime === t ? '' : t)}
                />
              ))}
            </View>
          </View>

          <Divider />

          {/* Fitness equipment */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Fitness Equipment Access
            </Text>
            <View style={styles.chipRow}>
              {FITNESS_EQUIPMENT_OPTIONS.map((eq) => (
                <OptionChip
                  key={eq}
                  label={eq}
                  selected={fitnessEquipment.includes(eq)}
                  onPress={() => toggleFitnessEquipment(eq)}
                />
              ))}
            </View>
          </View>

          <Divider />

          {/* Injuries */}
          <Input
            label="Any injuries or limitations?"
            placeholder="e.g. Bad lower back, shoulder impingement..."
            value={injuries}
            onChangeText={setInjuries}
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
      </Card>

      {/* ── Settings ─────────────────────────────────────────── */}
      <SectionHeader title="Settings" />
      <Card>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/notifications')}
          style={[
            styles.listOption,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
            <Text
              style={[
                typography.label,
                { color: colors.text, marginLeft: spacing.md },
              ]}
            >
              Notification Settings
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </Card>

      {/* ── Save Button ──────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xl, marginBottom: spacing['3xl'] }}>
        <Button title="Save Profile" onPress={handleSave} />
      </View>
    </ScreenContainer>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    padding: 4,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  dayChip: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
