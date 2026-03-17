import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import type { CoachTone } from '@health-coach/shared';

const TONE_OPTIONS: { value: CoachTone; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    value: 'direct',
    label: 'Direct',
    description: 'No-nonsense, straight to the point. Tell me what to do and hold me accountable.',
    icon: 'flash-outline',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'A mix of encouragement and honest feedback. Supportive but not sugar-coated.',
    icon: 'swap-horizontal-outline',
  },
  {
    value: 'encouraging',
    label: 'Encouraging',
    description: 'Positive, motivational, and patient. Celebrate every win, big or small.',
    icon: 'sunny-outline',
  },
];

export default function CoachToneScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const store = useOnboardingStore();

  return (
    <ScreenContainer>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={5 / 6} style={{ marginBottom: spacing.xl }} />

        <Text style={[typography.h1, { color: colors.text }]}>Coach Personality</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] }]}>
          How should your AI coach communicate with you?
        </Text>

        <View style={{ gap: spacing.md }}>
          {TONE_OPTIONS.map((tone) => {
            const isSelected = store.coachTone === tone.value;
            return (
              <TouchableOpacity
                key={tone.value}
                onPress={() => store.setCoachTone(tone.value)}
                activeOpacity={0.7}
                style={[
                  styles.toneCard,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                  },
                ]}
              >
                <View style={styles.toneHeader}>
                  <Ionicons
                    name={tone.icon}
                    size={24}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typography.h3,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        marginLeft: spacing.md,
                        flex: 1,
                      },
                    ]}
                  >
                    {tone.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </View>
                <Text
                  style={[
                    typography.body,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      marginTop: spacing.sm,
                      marginLeft: 36 + spacing.md,
                    },
                  ]}
                >
                  {tone.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.buttons, { marginTop: spacing['2xl'], gap: spacing.md }]}>
          <Button
            title="Continue"
            onPress={() => router.push('/(onboarding)/complete')}
          />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  toneCard: {
    borderWidth: 1,
  },
  toneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttons: {},
});
