import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer, ProgressBar } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useAuthStore } from '../../src/stores/auth-store';
import { useProfileStore } from '../../src/stores/profile-store';
import type { HealthGoal } from '../../src/stores/profile-store';
import { supabase } from '../../src/lib/supabase';
import { useState } from 'react';
import { isHealthPlatform } from '../../src/lib/health';
import { EQUIPMENT_CATALOG } from '../../src/types/onboarding';

export default function CompleteScreen() {
  const { colors, spacing, typography } = useTheme();
  const onboarding = useOnboardingStore();
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setIsOnboarded = useAuthStore((s) => s.setIsOnboarded);
  const setCoachPreferences = useAuthStore((s) => s.setCoachPreferences);
  const updateProfileStore = useProfileStore((s) => s.updateProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    // Build user_equipment jsonb from selectedEquipment + equipmentWeights + catalog
    const userEquipment = onboarding.selectedEquipment.map((eqId) => {
      const catalogItem = EQUIPMENT_CATALOG.find((c) => c.id === eqId);
      return {
        id: eqId,
        name: catalogItem?.name ?? eqId,
        category: catalogItem?.category ?? 'other',
        available: true,
        weights: onboarding.equipmentWeights[eqId] ?? [],
      };
    });

    // Resolve effective training days
    const effectiveTrainingDays = onboarding.getEffectiveTrainingDays();

    try {
      // Update profile (row already exists from handle_new_user trigger)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: onboarding.displayName || null,
          date_of_birth: onboarding.dateOfBirth || null,
          gender: onboarding.gender,
          height_cm: onboarding.heightCm,
          weight_kg: onboarding.weightKg,
          unit_preference: onboarding.unitPreference,
          product_mode: onboarding.productMode ?? 'full_health_coach',
          onboarding_completed: true,
          onboarding_version: 2,
          // v2 fields
          fitness_goal: onboarding.fitnessGoal,
          experience_level: onboarding.experienceLevel,
          consistency_level: onboarding.consistencyLevel,
          gym_type: onboarding.gymType,
          gym_name: onboarding.gymName || null,
          training_days_per_week: onboarding.trainingDaysPerWeek,
          specific_training_days: effectiveTrainingDays,
          session_duration_pref: onboarding.sessionDuration,
          injuries: [],  // TODO: wire up injury selection if added to onboarding
          user_equipment: userEquipment,
          attribution_source: onboarding.attributionSource,
          notification_time: onboarding.notificationTime || '09:00',
          notifications_enabled: onboarding.notificationsEnabled,
          health_sync_enabled: onboarding.healthSyncEnabled,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      // Update coach preferences (row already exists from handle_new_user trigger)
      const { data: coachPrefs, error: coachError } = await supabase
        .from('coach_preferences')
        .update({
          tone: onboarding.coachTone || 'balanced',
          focus_areas: onboarding.selectedGoals.length > 0 ? onboarding.selectedGoals : null,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (coachError) {
        console.error('Coach preferences update error:', coachError);
        // Non-critical — don't throw, profile was already saved
      }

      if (profile) setProfile(profile);
      if (coachPrefs) setCoachPreferences(coachPrefs);

      // Sync into local profile store for Coach and recipe generator
      updateProfileStore({
        displayName: onboarding.displayName,
        dateOfBirth: onboarding.dateOfBirth || undefined,
        gender: onboarding.gender || undefined,
        heightCm: onboarding.heightCm || undefined,
        weightKg: onboarding.weightKg || undefined,
        unitPreference: onboarding.unitPreference,
        healthGoals: onboarding.selectedGoals as HealthGoal[],
        primaryGoal: onboarding.selectedGoals[0] || undefined,
        fitnessGoal: onboarding.fitnessGoal || undefined,
        trainingDaysPerWeek: onboarding.trainingDaysPerWeek ?? undefined,
        preferredWorkoutDays: effectiveTrainingDays,
        fitnessEquipment: onboarding.selectedEquipment,
        consistencyLevel: onboarding.consistencyLevel || undefined,
        sessionDuration: onboarding.sessionDuration || undefined,
        gymType: onboarding.gymType || undefined,
        trainingExperience: onboarding.experienceLevel
          ? (['beginner'].includes(onboarding.experienceLevel) ? 'beginner'
             : ['less_than_1_year', '1_to_2_years'].includes(onboarding.experienceLevel) ? 'intermediate'
             : 'advanced')
          : (onboarding.consistencyLevel === 'never_consistent' ? 'beginner'
             : onboarding.consistencyLevel === 'very_consistent' ? 'advanced'
             : 'intermediate'),
      });

      setIsOnboarded(true);
      onboarding.reset();

      // Offer health connection on mobile before going to tabs
      if (isHealthPlatform()) {
        router.replace('/health-connect');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setError('Failed to save your profile. Please try again.');
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

          {error && (
            <Text style={[typography.body, { color: colors.error, marginTop: spacing.md, textAlign: 'center' }]}>
              {error}
            </Text>
          )}

          <View style={[styles.summary, { marginTop: spacing['2xl'], gap: spacing.md }]}>
            <SummaryRow label="Name" value={onboarding.displayName || user?.email?.split('@')[0] || 'User'} colors={colors} typography={typography} spacing={spacing} />
            <SummaryRow
              label="Goal"
              value={
                onboarding.fitnessGoal
                  ? onboarding.fitnessGoal.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'Not set'
              }
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <SummaryRow
              label="Experience"
              value={
                onboarding.experienceLevel
                  ? onboarding.experienceLevel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'Not set'
              }
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <SummaryRow
              label="Training Days"
              value={`${onboarding.trainingDaysPerWeek ?? 3} days/week`}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <SummaryRow
              label="Equipment"
              value={`${onboarding.selectedEquipment.length} items`}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: spacing['2xl'] }]}>
          <Button
            title={error ? 'Retry' : 'Start Your Journey'}
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
  colors: ReturnType<typeof import('../../src/theme').useTheme>['colors'];
  typography: ReturnType<typeof import('../../src/theme').useTheme>['typography'];
  spacing: ReturnType<typeof import('../../src/theme').useTheme>['spacing'];
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
