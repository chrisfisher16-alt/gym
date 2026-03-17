import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, Button, Input, ScreenContainer, Divider } from '../src/components/ui';
import { useProfileStore, type UserProfile } from '../src/stores/profile-store';
import { useToast } from '../src/components/Toast';

// ── Constants ────────────────────────────────────────────────────────

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const GOAL_OPTIONS = [
  { id: 'lose_fat', label: 'Lose Fat' },
  { id: 'build_muscle', label: 'Build Muscle' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'recomp', label: 'Recomposition' },
  { id: 'strength', label: 'Strength' },
  { id: 'endurance', label: 'Endurance' },
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

const EQUIPMENT_OPTIONS = [
  'Full Gym',
  'Home Gym',
  'Dumbbells Only',
  'Bodyweight Only',
  'Resistance Bands',
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

  // Local form state
  const [displayName, setDisplayName] = useState(storedProfile.displayName);
  const [dateOfBirth, setDateOfBirth] = useState(storedProfile.dateOfBirth ?? '');
  const [gender, setGender] = useState(storedProfile.gender ?? '');

  const [unitPreference, setUnitPreference] = useState(storedProfile.unitPreference);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCmStr, setHeightCmStr] = useState('');
  const [weightStr, setWeightStr] = useState('');

  const [primaryGoal, setPrimaryGoal] = useState(storedProfile.primaryGoal ?? '');
  const [targetWeightStr, setTargetWeightStr] = useState('');
  const [activityLevel, setActivityLevel] = useState(storedProfile.activityLevel ?? 0);

  const [trainingDays, setTrainingDays] = useState(storedProfile.trainingDaysPerWeek ?? 0);
  const [experience, setExperience] = useState(storedProfile.trainingExperience ?? '');
  const [injuries, setInjuries] = useState(storedProfile.injuriesOrLimitations ?? '');
  const [equipment, setEquipment] = useState<string[]>(storedProfile.availableEquipment ?? []);
  const [preferredTime, setPreferredTime] = useState(storedProfile.preferredTrainingTime ?? '');
  const [dietary, setDietary] = useState(storedProfile.dietaryRestrictions ?? '');

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

  const handleSave = () => {
    // Convert to metric for storage
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
      primaryGoal: primaryGoal || undefined,
      targetWeightKg,
      activityLevel: activityLevel > 0 ? activityLevel : undefined,
      trainingDaysPerWeek: trainingDays > 0 ? trainingDays : undefined,
      trainingExperience: experience as UserProfile['trainingExperience'] || undefined,
      injuriesOrLimitations: injuries || undefined,
      availableEquipment: equipment.length > 0 ? equipment : undefined,
      preferredTrainingTime: preferredTime || undefined,
      dietaryRestrictions: dietary || undefined,
    });

    showToast('Profile saved successfully', 'success');
    router.back();
  };

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item],
    );
  };

  // ── Shared sub-components ────────────────────────────────────────

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      style={[
        typography.labelSmall,
        {
          color: colors.textTertiary,
          marginBottom: spacing.sm,
          marginLeft: spacing.xs,
          marginTop: spacing.lg,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
      ]}
    >
      {title}
    </Text>
  );

  const OptionChip = ({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
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

  // ── Render ───────────────────────────────────────────────────────

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

      {/* ── Body Stats ─────────────────────────────────────────── */}
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
                    // Convert displayed values when switching
                    if (unit === 'metric') {
                      // Imperial → Metric
                      const ft = parseFloat(heightFeet) || 0;
                      const inches = parseFloat(heightInches) || 0;
                      if (ft > 0 || inches > 0)
                        setHeightCmStr(String(feetInchesToCm(ft, inches)));
                      const w = parseFloat(weightStr);
                      if (w > 0) setWeightStr(String(lbsToKg(w)));
                      const tw = parseFloat(targetWeightStr);
                      if (tw > 0) setTargetWeightStr(String(lbsToKg(tw)));
                    } else {
                      // Metric → Imperial
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
            label={`Weight (${unitPreference === 'imperial' ? 'lbs' : 'kg'})`}
            placeholder={unitPreference === 'imperial' ? '165' : '75'}
            keyboardType="numeric"
            value={weightStr}
            onChangeText={setWeightStr}
          />
        </View>
      </Card>

      {/* ── Fitness Goals ──────────────────────────────────────── */}
      <SectionHeader title="Fitness Goals" />
      <Card>
        <View style={{ gap: spacing.base }}>
          {/* Primary Goal */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              Primary Goal
            </Text>
            <View style={styles.chipRow}>
              {GOAL_OPTIONS.map((g) => (
                <OptionChip
                  key={g.id}
                  label={g.label}
                  selected={primaryGoal === g.id}
                  onPress={() => setPrimaryGoal(primaryGoal === g.id ? '' : g.id)}
                />
              ))}
            </View>
          </View>

          {/* Target Weight */}
          <Input
            label={`Target Weight (${unitPreference === 'imperial' ? 'lbs' : 'kg'})`}
            placeholder={unitPreference === 'imperial' ? '155' : '70'}
            keyboardType="numeric"
            value={targetWeightStr}
            onChangeText={setTargetWeightStr}
          />

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
                      borderColor:
                        activityLevel === level.value ? colors.primary : colors.border,
                      backgroundColor:
                        activityLevel === level.value
                          ? colors.primaryMuted
                          : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.label,
                        {
                          color:
                            activityLevel === level.value ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {level.label}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color:
                            activityLevel === level.value
                              ? colors.primary
                              : colors.textTertiary,
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
        </View>
      </Card>

      {/* ── Get to Know Me ─────────────────────────────────────── */}
      <SectionHeader title="Get to Know Me" />
      <Card>
        <View style={{ gap: spacing.base }}>
          {/* Training days per week */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              How many days per week can you train?
            </Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.7}
                  onPress={() => setTrainingDays(d)}
                  style={[
                    styles.dayChip,
                    {
                      borderColor: trainingDays === d ? colors.primary : colors.border,
                      backgroundColor:
                        trainingDays === d ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      {
                        color: trainingDays === d ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          {/* Training experience */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              What's your training experience?
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
                      borderColor:
                        experience === exp.id ? colors.primary : colors.border,
                      backgroundColor:
                        experience === exp.id ? colors.primaryMuted : colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.label,
                        {
                          color: experience === exp.id ? colors.primary : colors.text,
                        },
                      ]}
                    >
                      {exp.label}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color:
                            experience === exp.id
                              ? colors.primary
                              : colors.textTertiary,
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

          {/* Injuries or limitations */}
          <Input
            label="Any injuries or limitations?"
            placeholder="e.g. Bad lower back, shoulder impingement..."
            value={injuries}
            onChangeText={setInjuries}
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <Divider />

          {/* Equipment access */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              What equipment do you have access to?
            </Text>
            <View style={styles.chipRow}>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <OptionChip
                  key={eq}
                  label={eq}
                  selected={equipment.includes(eq)}
                  onPress={() => toggleEquipment(eq)}
                />
              ))}
            </View>
          </View>

          <Divider />

          {/* Preferred training time */}
          <View>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
              What time do you prefer to work out?
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

          {/* Dietary restrictions */}
          <Input
            label="Any dietary restrictions?"
            placeholder="e.g. Vegetarian, lactose intolerant..."
            value={dietary}
            onChangeText={setDietary}
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </View>
      </Card>

      {/* ── Save Button ────────────────────────────────────────── */}
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
