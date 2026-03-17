import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import type { ProductMode } from '@health-coach/shared';
import { PRODUCT_MODES } from '@health-coach/shared';
import { useState } from 'react';

const MODE_ICONS: Record<ProductMode, keyof typeof Ionicons.glyphMap> = {
  workout_coach: 'barbell-outline',
  nutrition_coach: 'nutrition-outline',
  full_health_coach: 'heart-outline',
};

const MODES = Object.entries(PRODUCT_MODES) as [ProductMode, { displayName: string; description: string }][];

export default function ModeScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const store = useOnboardingStore();
  const [selected, setSelected] = useState<ProductMode | null>(store.productMode);
  const [error, setError] = useState('');

  const onContinue = () => {
    if (!selected) {
      setError('Please select a mode');
      return;
    }
    store.setProductMode(selected);
    router.push('/(onboarding)/coach-tone');
  };

  return (
    <ScreenContainer>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={4 / 6} style={{ marginBottom: spacing.xl }} />

        <Text style={[typography.h1, { color: colors.text }]}>Choose Your Coach</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing['2xl'] }]}>
          You can always change this later.
        </Text>

        {error ? (
          <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.md }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: spacing.md }}>
          {MODES.map(([key, mode]) => {
            const isSelected = selected === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => { setError(''); setSelected(key); }}
                activeOpacity={0.7}
                style={[
                  styles.modeCard,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                  },
                ]}
              >
                <View style={styles.modeHeader}>
                  <Ionicons
                    name={MODE_ICONS[key]}
                    size={28}
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
                    {mode.displayName}
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
                      marginLeft: 40 + spacing.md,
                    },
                  ]}
                >
                  {mode.description}
                </Text>
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
  modeCard: {
    borderWidth: 1,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttons: {},
});
