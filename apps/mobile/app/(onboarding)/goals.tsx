import React, { useRef } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { SelectionCard } from '../../src/components/onboarding/SelectionCard';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { FITNESS_GOAL_OPTIONS } from '../../src/types/onboarding';
import type { FitnessGoal } from '../../src/types/onboarding';

export default function GoalsScreen() {
  const fitnessGoal = useOnboardingStore((s) => s.fitnessGoal);
  const setFitnessGoal = useOnboardingStore((s) => s.setFitnessGoal);

  const handleSelect = (goal: FitnessGoal) => {
    setFitnessGoal(goal);
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
      ctaEnabled={fitnessGoal !== null}
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
            onPress={() => handleSelect(option.value)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
