import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScreen } from '../../src/components/onboarding';
import { Button, Input, Divider, SegToggle } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useTheme } from '../../src/theme';
import { selectionFeedback } from '../../src/lib/haptics';
import type { Gender, UnitPreference } from '@health-coach/shared';

// ── Constants ────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: 'barbell-outline' as const, text: 'Personalized workout recommendations' },
  { icon: 'flame-outline' as const, text: 'Accurate calorie burn calculations' },
  { icon: 'trending-up-outline' as const, text: 'Track your fitness progress over time' },
  { icon: 'lock-closed-outline' as const, text: 'Secure and private — we never sell your data' },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const FEET_OPTIONS = [3, 4, 5, 6, 7, 8];
const INCHES_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Convert an age (years) to a synthetic DOB string for storage */
function ageToDOBString(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

const UNIT_OPTIONS: { value: UnitPreference; label: string }[] = [
  { value: 'imperial', label: 'Imperial' },
  { value: 'metric', label: 'Metric' },
];

// ── Helpers ──────────────────────────────────────────────────────────

function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462);
}

// ── Component ────────────────────────────────────────────────────────

export default function HealthSyncScreen() {
  const { colors, typography, spacing, radius } = useTheme();

  // Store
  const gender = useOnboardingStore((s) => s.gender);
  const dateOfBirth = useOnboardingStore((s) => s.dateOfBirth);
  // Derive age from stored DOB (if any)
  const storedAge = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth + 'T00:00:00').getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const heightCm = useOnboardingStore((s) => s.heightCm);
  const weightKg = useOnboardingStore((s) => s.weightKg);
  const unitPreference = useOnboardingStore((s) => s.unitPreference);
  const setHealthSyncEnabled = useOnboardingStore((s) => s.setHealthSyncEnabled);
  const setGender = useOnboardingStore((s) => s.setGender);
  const setDateOfBirth = useOnboardingStore((s) => s.setDateOfBirth);
  const setHeightCm = useOnboardingStore((s) => s.setHeightCm);
  const setWeightKg = useOnboardingStore((s) => s.setWeightKg);
  const setUnitPreference = useOnboardingStore((s) => s.setUnitPreference);

  // Local UI state
  const [genderOpen, setGenderOpen] = useState(false);
  const [ageText, setAgeText] = useState(() => storedAge != null && storedAge > 0 ? String(storedAge) : '');

  // Derived imperial values
  const { feet: derivedFeet, inches: derivedInches } = heightCm
    ? cmToFeetInches(heightCm)
    : { feet: 5, inches: 9 };


  const isMetric = unitPreference === 'metric';

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSync = () => {
    selectionFeedback();
    setHealthSyncEnabled(true);
    router.push('/(onboarding)/goals');
  };

  const handleNext = () => {
    router.push('/(onboarding)/goals');
  };

  const handleGenderSelect = (g: Gender) => {
    selectionFeedback();
    setGender(g);
    setGenderOpen(false);
  };

  const handleFeetSelect = (f: number) => {
    selectionFeedback();
    const currentInches = heightCm ? cmToFeetInches(heightCm).inches : 0;
    setHeightCm(feetInchesToCm(f, currentInches));
  };

  const handleInchesSelect = (i: number) => {
    selectionFeedback();
    const currentFeet = heightCm ? cmToFeetInches(heightCm).feet : 5;
    setHeightCm(feetInchesToCm(currentFeet, i));
  };

  const handleHeightCmChange = (text: string) => {
    const num = parseInt(text, 10);
    setHeightCm(isNaN(num) ? null : num);
  };

  // Keep weight as a raw text string to avoid premature rounding on partial input
  const [weightText, setWeightText] = useState(() => {
    if (weightKg == null) return '';
    return isMetric ? String(weightKg) : String(kgToLbs(weightKg));
  });

  const handleWeightChange = (text: string) => {
    // Allow the user to type freely — only convert when we have a real number
    const cleaned = text.replace(/[^0-9]/g, '');
    setWeightText(cleaned);
    if (!cleaned) {
      setWeightKg(null);
      return;
    }
    const num = parseInt(cleaned, 10);
    setWeightKg(isMetric ? num : lbsToKg(num));
  };

  const handleAgeChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setAgeText(cleaned);
    if (!cleaned) {
      setDateOfBirth('');
      return;
    }
    const age = parseInt(cleaned, 10);
    if (age >= 13 && age <= 120) {
      setDateOfBirth(ageToDOBString(age));
    }
  };

  const syncProvider = Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect';

  // ── Render ───────────────────────────────────────────────────────

  return (
    <OnboardingScreen
      step="health-sync"
      title="Your body stats"
      subtitle="Sync your health data for personalized recommendations, or enter manually."
      onNext={handleNext}
      showBack={false}
      keyboardAvoiding
    >
      {/* Section A — Health Sync */}
      <View style={[styles.syncCard, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border }]}>
        {BENEFITS.map((b) => (
          <View key={b.icon} style={[styles.benefitRow, { marginBottom: spacing.md }]}>
            <Ionicons name={b.icon} size={20} color={colors.primary} style={{ marginRight: spacing.md }} />
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{b.text}</Text>
          </View>
        ))}

        <Button
          title={`Sync with ${syncProvider}`}
          onPress={handleSync}
          icon={<Ionicons name="heart-outline" size={20} color={colors.textInverse} />}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>

      {/* Divider */}
      <Divider label="OR" style={{ marginVertical: spacing.xl }} />

      {/* Section B — Manual Entry */}
      <View>
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.xs }]}>
          Enter manually
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.lg }]}>
          Optional — can be added later
        </Text>

        {/* Unit Toggle */}
        <View style={{ marginBottom: spacing.lg }}>
          <SegToggle
            options={UNIT_OPTIONS}
            selected={unitPreference}
            onSelect={setUnitPreference}
          />
        </View>

        {/* Gender Dropdown */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
            Gender
          </Text>
          <TouchableOpacity
            onPress={() => { selectionFeedback(); setGenderOpen(!genderOpen); }}
            activeOpacity={0.7}
            style={[
              styles.dropdownTrigger,
              {
                borderColor: genderOpen ? colors.primary : colors.border,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.md,
                minHeight: 48,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Select gender"
          >
            <Text style={[typography.body, { color: gender ? colors.text : colors.textTertiary, flex: 1 }]}>
              {gender ? GENDER_OPTIONS.find((g) => g.value === gender)?.label : 'Select gender'}
            </Text>
            <Ionicons
              name={genderOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          {genderOpen && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleGenderSelect(opt.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.dropdownItem,
                    {
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
                      backgroundColor: gender === opt.value ? colors.surfaceSecondary : 'transparent',
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: gender === opt.value }}
                >
                  <Text style={[typography.body, { color: colors.text }]}>{opt.label}</Text>
                  {gender === opt.value && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Age */}
        <View style={{ marginBottom: spacing.lg }}>
          <Input
            label="Age"
            placeholder="e.g. 25"
            value={ageText}
            onChangeText={handleAgeChange}
            keyboardType="number-pad"
            maxLength={3}
            hint={ageText && (parseInt(ageText, 10) < 13 || parseInt(ageText, 10) > 120) ? 'Must be between 13 and 120' : undefined}
          />
        </View>

        {/* Height */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>
            Height
          </Text>
          {isMetric ? (
            <Input
              placeholder="cm"
              value={heightCm != null ? String(heightCm) : ''}
              onChangeText={handleHeightCmChange}
              keyboardType="number-pad"
              maxLength={3}
            />
          ) : (
            <View style={styles.heightRow}>
              {/* Feet Picker */}
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.xs }]}>
                  Feet
                </Text>
                <View style={[styles.pickerRow, { borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }]}>
                  {FEET_OPTIONS.map((f) => {
                    const isSelected = heightCm != null && cmToFeetInches(heightCm).feet === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        onPress={() => handleFeetSelect(f)}
                        style={[
                          styles.pickerCell,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderRadius: radius.sm,
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Text style={[typography.body, { color: isSelected ? colors.textInverse : colors.text }]}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Inches Picker */}
              <View style={{ flex: 1.5 }}>
                <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.xs }]}>
                  Inches
                </Text>
                <View style={[styles.pickerRow, { borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, flexWrap: 'wrap' }]}>
                  {INCHES_OPTIONS.map((i) => {
                    const isSelected = heightCm != null && cmToFeetInches(heightCm).inches === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleInchesSelect(i)}
                        style={[
                          styles.pickerCell,
                          {
                            backgroundColor: isSelected ? colors.primary : 'transparent',
                            borderRadius: radius.sm,
                            width: '16.66%',
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Text style={[typography.body, { color: isSelected ? colors.textInverse : colors.text }]}>
                          {i}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Weight */}
        <View style={{ marginBottom: spacing.xl }}>
          <Input
            label="Weight"
            placeholder={isMetric ? 'kg' : 'lbs'}
            value={weightText}
            onChangeText={handleWeightChange}
            keyboardType="number-pad"
            maxLength={4}
            hint={isMetric ? 'kg' : 'lbs'}
          />
        </View>
      </View>
    </OnboardingScreen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  syncCard: {
    padding: 20,
    borderWidth: 1,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  dropdown: {
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heightRow: {
    flexDirection: 'row',
  },
  pickerRow: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 4,
  },
  pickerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flex: 1,
  },

});
