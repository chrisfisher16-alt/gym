/**
 * Schedule + Consistency + Duration — Onboarding Step 3
 *
 * Lets the user configure:
 *  A. Training schedule (days per week OR specific days)
 *  B. Consistency level
 *  C. Session duration (optional)
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { SelectionCard } from '../../src/components/onboarding/SelectionCard';
import { SegToggle } from '../../src/components/ui';
import { selectionFeedback } from '../../src/lib/haptics';
import {
  DAY_PILLS,
  CONSISTENCY_LEVEL_OPTIONS,
  SESSION_DURATION_OPTIONS,
} from '../../src/types/onboarding';
import type { ScheduleMode, ConsistencyLevel, SessionDuration } from '../../src/types/onboarding';
import type { Weekday } from '@health-coach/shared';

const DAYS_PER_WEEK = [1, 2, 3, 4, 5, 6] as const;

const SCHEDULE_MODE_OPTIONS: { value: ScheduleMode; label: string }[] = [
  { value: 'days_per_week', label: 'Days Per Week' },
  { value: 'specific_days', label: 'Specific Days' },
];

export default function ScheduleScreen() {
  const { colors, typography, spacing, radius } = useTheme();

  // ── Store state ────────────────────────────────────────────────
  const scheduleMode = useOnboardingStore((s) => s.scheduleMode);
  const trainingDaysPerWeek = useOnboardingStore((s) => s.trainingDaysPerWeek);
  const specificTrainingDays = useOnboardingStore((s) => s.specificTrainingDays);
  const consistencyLevel = useOnboardingStore((s) => s.consistencyLevel);
  const sessionDuration = useOnboardingStore((s) => s.sessionDuration);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);

  // ── Store actions ──────────────────────────────────────────────
  const setScheduleMode = useOnboardingStore((s) => s.setScheduleMode);
  const setTrainingDaysPerWeek = useOnboardingStore((s) => s.setTrainingDaysPerWeek);
  const toggleTrainingDay = useOnboardingStore((s) => s.toggleTrainingDay);
  const setConsistencyLevel = useOnboardingStore((s) => s.setConsistencyLevel);
  const setSessionDuration = useOnboardingStore((s) => s.setSessionDuration);

  // ── Derived ────────────────────────────────────────────────────
  const isBeginnerish =
    experienceLevel === 'beginner' || experienceLevel === 'less_than_1_year';

  const subtitle = isBeginnerish
    ? 'We recommend starting with 3 days per week.'
    : 'Set your preferred training schedule.';

  const scheduleSet =
    scheduleMode === 'days_per_week'
      ? trainingDaysPerWeek !== null
      : specificTrainingDays.length > 0;

  const ctaEnabled = scheduleSet && consistencyLevel !== null;

  // ── Handlers ───────────────────────────────────────────────────
  const handleDaysPerWeekSelect = (days: number) => {
    selectionFeedback();
    setTrainingDaysPerWeek(days);
  };

  const handleDayToggle = (day: Weekday) => {
    selectionFeedback();
    toggleTrainingDay(day);
  };

  const handleConsistencySelect = (level: ConsistencyLevel) => {
    setConsistencyLevel(level);
  };

  const handleDurationSelect = (duration: SessionDuration) => {
    selectionFeedback();
    setSessionDuration(duration);
  };

  const handleNext = () => {
    router.push('/(onboarding)/gym-type');
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <OnboardingScreen
      step="schedule"
      title="How do you want to train?"
      subtitle={subtitle}
      ctaLabel="Next"
      ctaEnabled={ctaEnabled}
      onNext={handleNext}
    >
      {/* ── Section A: Training Schedule ─────────────────────────── */}
      <SegToggle
        options={SCHEDULE_MODE_OPTIONS}
        selected={scheduleMode}
        onSelect={setScheduleMode}
      />

      <View style={{ marginTop: spacing.lg }}>
        {scheduleMode === 'days_per_week' ? (
          <View style={styles.pillRow}>
            {DAYS_PER_WEEK.map((num) => {
              const isSelected = trainingDaysPerWeek === num;
              return (
                <Pressable
                  key={num}
                  onPress={() => handleDaysPerWeekSelect(num)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelLarge,
                      {
                        color: isSelected ? colors.textOnPrimary : colors.textSecondary,
                      },
                    ]}
                  >
                    {num}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.pillRow}>
            {DAY_PILLS.map((day) => {
              const isSelected = specificTrainingDays.includes(day.value);
              return (
                <Pressable
                  key={day.value}
                  onPress={() => handleDayToggle(day.value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelLarge,
                      {
                        color: isSelected ? colors.textOnPrimary : colors.textSecondary,
                      },
                    ]}
                  >
                    {day.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Section B: Consistency ───────────────────────────────── */}
      <Text
        style={[
          typography.h3,
          { color: colors.text, marginTop: spacing['2xl'], marginBottom: spacing.base },
        ]}
      >
        How consistent have you been?
      </Text>

      {CONSISTENCY_LEVEL_OPTIONS.map((opt) => (
        <SelectionCard
          key={opt.value}
          label={opt.label}
          selected={consistencyLevel === opt.value}
          onPress={() => handleConsistencySelect(opt.value)}
          compact
        />
      ))}

      {/* ── Section C: Session Duration ──────────────────────────── */}
      <Text
        style={[
          typography.h3,
          { color: colors.text, marginTop: spacing['2xl'], marginBottom: spacing.base },
        ]}
      >
        How long do you want to train?
      </Text>

      <View style={styles.pillRow}>
        {SESSION_DURATION_OPTIONS.map((opt) => {
          const isSelected = sessionDuration === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => handleDurationSelect(opt.value)}
              style={[
                styles.durationPill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelXS,
                  {
                    color: isSelected ? colors.textOnPrimary : colors.textSecondary,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationPill: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
