import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useState } from 'react';

const GOAL_OPTIONS = [
  { id: 'lose_weight', label: 'Lose Weight', icon: 'scale-outline' as const },
  { id: 'gain_muscle', label: 'Gain Muscle', icon: 'barbell-outline' as const },
  { id: 'build_lean_muscle', label: 'Build Lean Muscle', icon: 'body-outline' as const },
  { id: 'improve_endurance', label: 'Improve Endurance', icon: 'heart-outline' as const },
  { id: 'maintain_weight', label: 'Maintain Weight', icon: 'fitness-outline' as const },
  { id: 'improve_general_health', label: 'Improve General Health', icon: 'medkit-outline' as const },
];

export default function GoalsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const store = useOnboardingStore();
  const [selected, setSelected] = useState<string[]>(store.selectedGoals);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setError('');
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const onContinue = () => {
    if (selected.length === 0) {
      setError('Select at least one goal');
      return;
    }
    store.setSelectedGoals(selected);
    router.push('/(onboarding)/mode');
  };

  return (
    <ScreenContainer>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={3 / 6} style={{ marginBottom: spacing.xl }} />

        <Text style={[typography.h1, { color: colors.text }]}>Your Goals</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] }]}>
          Select all that apply. We&apos;ll tailor your experience.
        </Text>

        {error ? (
          <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.md }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: spacing.md }}>
          {GOAL_OPTIONS.map((goal) => {
            const isSelected = selected.includes(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => toggle(goal.id)}
                activeOpacity={0.7}
                style={[
                  styles.goalCard,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.base,
                  },
                ]}
              >
                <Ionicons
                  name={goal.icon}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.labelLarge,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      marginLeft: spacing.md,
                      flex: 1,
                    },
                  ]}
                >
                  {goal.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.buttons, { marginTop: spacing['2xl'], gap: spacing.md }]}>
          <Button title="Continue" onPress={onContinue} />
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
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 56,
  },
  buttons: {},
});
