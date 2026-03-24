import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useTheme } from '../../src/theme';
import { selectionFeedback } from '../../src/lib/haptics';
import { ATTRIBUTION_OPTIONS, type AttributionSource } from '../../src/types/onboarding';

export default function AttributionScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const attributionSource = useOnboardingStore((s) => s.attributionSource);
  const setAttributionSource = useOnboardingStore((s) => s.setAttributionSource);

  const handleSelect = (source: AttributionSource) => {
    selectionFeedback();
    setAttributionSource(source);
  };

  const handleNext = () => {
    router.push('/(onboarding)/generating');
  };

  return (
    <OnboardingScreen
      step="attribution"
      title="How did you hear about FormIQ?"
      ctaLabel="Next"
      ctaEnabled
      onNext={handleNext}
    >
      <View style={{ marginTop: spacing.sm }}>
        {ATTRIBUTION_OPTIONS.map((option, index) => {
          const isSelected = attributionSource === option.value;
          const isLast = index === ATTRIBUTION_OPTIONS.length - 1;

          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              style={[
                styles.row,
                {
                  borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                  paddingVertical: spacing.base,
                },
              ]}
            >
              <Text
                style={[
                  typography.body,
                  { color: colors.text, flex: 1 },
                ]}
              >
                {option.label}
              </Text>

              {/* Radio circle */}
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: isSelected ? colors.primary : colors.textTertiary,
                    borderWidth: isSelected ? 0 : 2,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected && (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: colors.textInverse },
                    ]}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
