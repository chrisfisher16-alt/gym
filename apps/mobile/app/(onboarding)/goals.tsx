import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { SelectionCard } from '../../src/components/onboarding/SelectionCard';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { FITNESS_GOAL_OPTIONS, EXPERIENCE_LEVEL_OPTIONS } from '../../src/types/onboarding';
import type { FitnessGoal, ExperienceLevel } from '../../src/types/onboarding';
import { useTheme } from '../../src/theme';

export default function GoalsScreen() {
  const { colors, typography, spacing } = useTheme();

  const fitnessGoal = useOnboardingStore((s) => s.fitnessGoal);
  const setFitnessGoal = useOnboardingStore((s) => s.setFitnessGoal);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);

  const handleSelectGoal = (goal: FitnessGoal) => {
    setFitnessGoal(goal);
  };

  const handleSelectExperience = (level: ExperienceLevel) => {
    setExperienceLevel(level);
  };

  const isNavigating = useRef(false);
  const handleNext = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push('/(onboarding)/schedule');
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  return (
    <OnboardingScreen
      step="goals"
      title="What's your main goal?"
      subtitle="We'll tailor your training plan to match."
      ctaLabel="Next"
      ctaEnabled={fitnessGoal !== null && experienceLevel !== null}
      onNext={handleNext}
    >
      <View>
        {FITNESS_GOAL_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            description={option.description}
            icon={option.icon}
            selected={fitnessGoal === option.value}
            onPress={() => handleSelectGoal(option.value)}
          />
        ))}
      </View>

      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        How long have you been training?
      </Text>

      <View>
        {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            selected={experienceLevel === option.value}
            onPress={() => handleSelectExperience(option.value)}
            compact
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
