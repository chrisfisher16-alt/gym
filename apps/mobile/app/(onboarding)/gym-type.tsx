import React, { useRef } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { SelectionCard } from '../../src/components/onboarding/SelectionCard';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { GYM_TYPE_OPTIONS } from '../../src/types/onboarding';
import type { GymType } from '../../src/types/onboarding';

export default function GymTypeScreen() {
  const gymType = useOnboardingStore((s) => s.gymType);
  const setGymType = useOnboardingStore((s) => s.setGymType);

  const handleSelect = (type: GymType) => {
    setGymType(type);
  };

  const isNavigating = useRef(false);
  const handleNext = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    if (gymType === 'large_gym') {
      router.push('/(onboarding)/gym-search');
    } else {
      router.push('/(onboarding)/equipment');
    }
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  return (
    <OnboardingScreen
      step="gym-type"
      title="Where do you usually work out?"
      subtitle="This helps us set up your equipment and exercise selection."
      ctaLabel="Next"
      ctaEnabled={gymType !== null}
      onNext={handleNext}
    >
      <View>
        {GYM_TYPE_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            description={option.description}
            icon={option.icon}
            selected={gymType === option.value}
            onPress={() => handleSelect(option.value)}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}
