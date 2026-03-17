import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { supabase } from '../../src/lib/supabase';
import { useState } from 'react';

export default function CompleteScreen() {
  const { colors, spacing, typography } = useTheme();
  const onboarding = useOnboardingStore();
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setIsOnboarded = useAuthStore((s) => s.setIsOnboarded);
  const setCoachPreferences = useAuthStore((s) => s.setCoachPreferences);
  const [saving, setSaving] = useState(false);

  const finishOnboarding = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Save profile
      const profileData = {
        user_id: user.id,
        display_name: onboarding.displayName,
        date_of_birth: onboarding.dateOfBirth || null,
        gender: onboarding.gender,
        height_cm: onboarding.heightCm,
        weight_kg: onboarding.weightKg,
        unit_preference: onboarding.unitPreference,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: profile } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();

      // Save coach preferences
      const coachData = {
        user_id: user.id,
        product_mode: onboarding.productMode,
        coach_tone: onboarding.coachTone,
        focus_areas: onboarding.selectedGoals,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: coachPrefs } = await supabase
        .from('coach_preferences')
        .upsert(coachData)
        .select()
        .single();

      if (profile) setProfile(profile);
      if (coachPrefs) setCoachPreferences(coachPrefs);
      setIsOnboarded(true);
      onboarding.reset();
      router.replace('/(tabs)');
    } catch {
      // Fallback: mark as onboarded anyway so user isn't stuck
      setIsOnboarded(true);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scrollable={false}>
      <View style={[styles.content, { paddingTop: spacing.base }]}>
        <ProgressBar progress={1} style={{ marginBottom: spacing['3xl'] }} />

        <View style={styles.center}>
          <View
            style={[
              styles.successCircle,
              { backgroundColor: colors.successLight },
            ]}
          >
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          </View>

          <Text style={[typography.displayMedium, { color: colors.text, marginTop: spacing['2xl'], textAlign: 'center' }]}>
            You&apos;re All Set!
          </Text>
          <Text style={[typography.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}>
            Your personalized health coaching experience is ready.
          </Text>

          <View style={[styles.summary, { marginTop: spacing['2xl'], gap: spacing.md }]}>
            <SummaryRow label="Name" value={onboarding.displayName} colors={colors} typography={typography} spacing={spacing} />
            <SummaryRow
              label="Mode"
              value={
                onboarding.productMode === 'workout_coach'
                  ? 'Workout Coach'
                  : onboarding.productMode === 'nutrition_coach'
                  ? 'Nutrition Coach'
                  : 'Full Health Coach'
              }
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <SummaryRow
              label="Coach Style"
              value={onboarding.coachTone.charAt(0).toUpperCase() + onboarding.coachTone.slice(1)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <SummaryRow
              label="Goals"
              value={`${onboarding.selectedGoals.length} selected`}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: spacing['2xl'] }]}>
          <Button
            title="Start Your Journey"
            onPress={finishOnboarding}
            loading={saving}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function SummaryRow({
  label,
  value,
  colors,
  typography: typo,
  spacing: sp,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={[summaryStyles.row, { paddingVertical: sp.sm }]}>
      <Text style={[typo.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typo.label, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    width: '100%',
  },
  bottom: {
    width: '100%',
  },
});

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
