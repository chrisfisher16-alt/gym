import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { goldPulse } from '../../src/lib/animations';
import { successNotification, lightImpact } from '../../src/lib/haptics';
import {
  getRecommendedProgram,
  FITNESS_GOAL_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  GYM_TYPE_OPTIONS,
  SESSION_DURATION_OPTIONS,
  ONBOARDING_DEFAULTS,
} from '../../src/types/onboarding';

// ── Loading Lines ───────────────────────────────────────────────────

const LOADING_LINES = [
  'Analyzing your goals...',
  'Selecting exercises...',
  'Optimizing your schedule...',
  'Your program is ready',
] as const;

const LINE_DELAY = 700; // ms between each line appearing
const TRANSITION_DELAY = 800; // ms after last line before switching to phase 2

// ── Component ───────────────────────────────────────────────────────

export default function GeneratingScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  // Phase state
  const [phase, setPhase] = useState<1 | 2>(1);

  // Onboarding data
  const fitnessGoal = useOnboardingStore((s) => s.fitnessGoal);
  const experienceLevel = useOnboardingStore((s) => s.experienceLevel);
  const scheduleMode = useOnboardingStore((s) => s.scheduleMode);
  const trainingDaysPerWeek = useOnboardingStore((s) => s.trainingDaysPerWeek);
  const specificTrainingDays = useOnboardingStore((s) => s.specificTrainingDays);
  const gymType = useOnboardingStore((s) => s.gymType);
  const sessionDuration = useOnboardingStore((s) => s.sessionDuration);
  const selectedEquipment = useOnboardingStore((s) => s.selectedEquipment);
  const getEffectiveTrainingDays = useOnboardingStore((s) => s.getEffectiveTrainingDays);
  const [isSaving, setIsSaving] = useState(false);

  // Derived values
  const effectiveDays = getEffectiveTrainingDays();
  const goal = fitnessGoal ?? ONBOARDING_DEFAULTS.fitnessGoal;
  const experience = experienceLevel ?? ONBOARDING_DEFAULTS.experienceLevel;
  const recommendation = getRecommendedProgram(goal, experience, effectiveDays.length, sessionDuration);

  // Look up display labels
  const goalLabel =
    FITNESS_GOAL_OPTIONS.find((o) => o.value === goal)?.label ?? goal;
  const experienceLabel =
    EXPERIENCE_LEVEL_OPTIONS.find((o) => o.value === experience)?.label ?? experience;
  const gymLabel =
    GYM_TYPE_OPTIONS.find((o) => o.value === (gymType ?? ONBOARDING_DEFAULTS.gymType))?.label ??
    gymType ??
    'Large Gym';
  const durationLabel =
    SESSION_DURATION_OPTIONS.find(
      (o) => o.value === (sessionDuration ?? ONBOARDING_DEFAULTS.sessionDuration),
    )?.label ?? '60 min';

  const scheduleLabel =
    scheduleMode === 'specific_days' && specificTrainingDays.length > 0
      ? `${specificTrainingDays.length} days/week`
      : `${effectiveDays.length} days/week`;

  // ── Phase 1 Animations ──────────────────────────────────────────

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const lineAnims = useRef(LOADING_LINES.map(() => new Animated.Value(0))).current;
  const phase2Opacity = useRef(new Animated.Value(0)).current;
  const phase2Translate = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Start gold pulse
    const pulse = goldPulse(pulseAnim);
    pulse.start();

    // Stagger text lines
    const lineTimers: ReturnType<typeof setTimeout>[] = [];
    LOADING_LINES.forEach((_, i) => {
      const timer = setTimeout(() => {
        Animated.timing(lineAnims[i], {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, i * LINE_DELAY);
      lineTimers.push(timer);
    });

    // Transition to Phase 2
    const transitionTimer = setTimeout(() => {
      pulse.stop();
      successNotification();
      setPhase(2);
    }, LOADING_LINES.length * LINE_DELAY + TRANSITION_DELAY);

    return () => {
      pulse.stop();
      lineTimers.forEach(clearTimeout);
      clearTimeout(transitionTimer);
    };
  }, []);

  // Phase 2 entrance animation
  useEffect(() => {
    if (phase === 2) {
      Animated.parallel([
        Animated.timing(phase2Opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(phase2Translate, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase]);



  // ── Actions ─────────────────────────────────────────────────────

  const handleStartTraining = useCallback(async () => {
    setIsSaving(true);
    try {
      // Ensure workout store is initialized (loads seed programs from AsyncStorage)
      const store = useWorkoutStore.getState();
      if (!store.isInitialized) {
        await store.initialize();
      }

      // Determine available equipment types from onboarding
      const userGymType = gymType ?? 'large_gym';
      const isHomeOrNoEquip = userGymType === 'at_home' || userGymType === 'no_equipment';
      const isGarageGym = userGymType === 'garage_gym';

      // Map selected equipment IDs to exercise equipment types
      const hasBarbell = selectedEquipment.some((e) =>
        ['barbell', 'weight_plates', 'squat_rack'].includes(e),
      );
      const hasCable = selectedEquipment.some((e) =>
        ['cable_crossover', 'lat_pulldown', 'seated_cable_row', 'cable_tower'].includes(e),
      );
      const hasMachine = selectedEquipment.some((e) =>
        ['leg_press', 'leg_extension', 'leg_curl', 'hack_squat', 'chest_press_machine', 'shoulder_press_machine', 'pec_deck', 'calf_raise_machine', 'smith_machine'].includes(e),
      );

      // Activate the program that best matches the recommendation
      const { programs, setActiveProgram, exercises: exerciseLibrary } = useWorkoutStore.getState();
      if (programs.length > 0) {
        const style = recommendation.style.toLowerCase();

        // Score each program for compatibility
        const scored = programs.map((p) => {
          let score = 0;

          // Style match (high weight)
          const name = p.name.toLowerCase();
          if (style.includes('ppl') && name.includes('ppl')) score += 50;
          if (style.includes('strength') && name.includes('strength')) score += 50;
          if (style.includes('bro split') && name.includes('hypertrophy')) score += 50;
          if (style.includes('full body') && (name.includes('full body') || name.includes('beginner'))) score += 50;

          // Days per week match (moderate weight)
          const dayDiff = Math.abs(p.daysPerWeek - recommendation.daysPerWeek);
          score += Math.max(0, 30 - dayDiff * 10);

          // Difficulty match (moderate weight)
          const expIsBeginnerish = experience === 'beginner' || experience === 'less_than_1_year';
          if (expIsBeginnerish && p.difficulty === 'beginner') score += 20;
          if (!expIsBeginnerish && p.difficulty !== 'beginner') score += 10;

          // Equipment compatibility: count exercises that user can actually do
          let compatibleExercises = 0;
          let totalExercises = 0;
          for (const day of p.days) {
            for (const ex of day.exercises) {
              totalExercises++;
              const libEntry = exerciseLibrary.find((e) => e.id === ex.exerciseId);
              if (!libEntry) { compatibleExercises++; continue; } // unknown = assume compatible
              const eq = libEntry.equipment;
              if (eq === 'bodyweight' || eq === 'dumbbell' || eq === 'band' || eq === 'kettlebell') {
                compatibleExercises++; // most users have these
              } else if (eq === 'barbell' && hasBarbell) {
                compatibleExercises++;
              } else if (eq === 'cable' && hasCable) {
                compatibleExercises++;
              } else if (eq === 'machine' && hasMachine) {
                compatibleExercises++;
              } else if (userGymType === 'large_gym') {
                compatibleExercises++; // large gym has everything
              }
            }
          }
          // Equipment compatibility ratio (high weight for home users)
          if (totalExercises > 0) {
            const ratio = compatibleExercises / totalExercises;
            score += Math.round(ratio * (isHomeOrNoEquip ? 40 : 15));
          }

          // Duration match bonus — programs closer to user's preferred duration score higher
          if (sessionDuration) {
            const targetMinutes = { '30_min': 30, '45_min': 45, '60_min': 55, '75_plus_min': 75 }[sessionDuration] || 55;
            // Estimate program duration from exercise count (no estimatedMinutes on seed programs)
            const totalSets = p.days.reduce((sum, day) => sum + day.exercises.reduce((s, ex) => s + ex.targetSets, 0), 0);
            const avgSetsPerDay = p.days.length > 0 ? totalSets / p.days.length : 0;
            // Rough estimate: ~2.5 min per set (including rest)
            const estimatedProgramMinutes = Math.round(avgSetsPerDay * 2.5);
            if (estimatedProgramMinutes > 0) {
              const diff = Math.abs(estimatedProgramMinutes - targetMinutes);
              if (diff <= 10) score += 15;      // Close match
              else if (diff <= 20) score += 5;   // Acceptable
              else score -= 10;                   // Poor match
            }
          }

          return { program: p, score };
        });

        // Pick the highest-scoring program
        scored.sort((a, b) => b.score - a.score);
        const bestMatch = scored[0].program;
        setActiveProgram(bestMatch.id);
      }

      // Navigate to complete screen which handles Supabase save, coach prefs, and reset
      router.replace('/(onboarding)/complete');
    } catch (err: any) {
      crossPlatformAlert('Something went wrong', err?.message || 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [recommendation, gymType, selectedEquipment, experience]);

  const handleBrowsePrograms = useCallback(() => {
    // Navigate to complete screen which handles Supabase save, coach prefs, and reset
    router.replace('/(onboarding)/complete');
  }, []);

  const handleBack = useCallback(() => {
    lightImpact();
    router.back();
  }, []);

  // ── Phase 1: Loading ────────────────────────────────────────────

  if (phase === 1) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.loadingCenter}>
          {/* Pulsing gold ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              {
                borderColor: colors.gold,
                opacity: pulseAnim,
              },
            ]}
          />

          {/* Staggered text lines */}
          <View style={[styles.loadingText, { marginTop: spacing['3xl'] }]}>
            {LOADING_LINES.map((line, i) => (
              <Animated.Text
                key={line}
                style={[
                  typography.body,
                  {
                    color: i === LOADING_LINES.length - 1 ? colors.primary : colors.textSecondary,
                    textAlign: 'center',
                    marginBottom: spacing.sm,
                    opacity: lineAnims[i],
                    fontWeight: i === LOADING_LINES.length - 1 ? '600' : '400',
                  },
                ]}
              >
                {line}
              </Animated.Text>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Phase 2: Program Summary ────────────────────────────────────

  const summaryRows: { label: string; value: string; screen?: string }[] = [
    { label: 'Goal', value: goalLabel, screen: '/(onboarding)/goals' },
    { label: 'Experience', value: experienceLabel, screen: '/(onboarding)/goals' },
    { label: 'Schedule', value: scheduleLabel, screen: '/(onboarding)/schedule' },
    { label: 'Session Length', value: durationLabel || '45 min', screen: '/(onboarding)/schedule' },
    { label: 'Training Style', value: recommendation.style },
    { label: 'Equipment', value: gymLabel, screen: '/(onboarding)/gym-type' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: phase2Opacity,
            transform: [{ translateY: phase2Translate }],
          },
        ]}
      >
        {/* Back button */}
        <View style={[styles.backHeader, { paddingTop: 6 }]}>
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { padding: spacing.lg, paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text
            style={[
              typography.h1,
              { color: colors.text, marginBottom: spacing.sm },
            ]}
          >
            Your program is ready
          </Text>
          <Text
            style={[
              typography.bodyLarge,
              { color: colors.textSecondary, marginBottom: spacing.xl },
            ]}
          >
            Review your personalized program below.
          </Text>

          {/* Summary Card */}
          <Card style={{ backgroundColor: colors.surfaceSecondary, marginBottom: spacing.lg }}>
            {summaryRows.map((row, i) => (
              <TouchableOpacity
                key={row.label}
                disabled={!row.screen}
                onPress={() => {
                  if (row.screen) router.push(row.screen as any);
                }}
                activeOpacity={row.screen ? 0.6 : 1}
                style={[
                  styles.summaryRow,
                  {
                    paddingVertical: spacing.md,
                    borderBottomColor: colors.divider,
                    borderBottomWidth: i < summaryRows.length - 1 ? 1 : 0,
                  },
                ]}
              >
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {row.label}
                </Text>
                <View style={styles.summaryValue}>
                  <Text style={[typography.body, { color: colors.text }]}>
                    {row.value}
                  </Text>
                  {row.screen && (
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textTertiary, marginLeft: spacing.xs },
                      ]}
                    >
                      ›
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card>

          {/* Recommended Program Card */}
          <Card style={{ marginBottom: spacing.lg }}>
            <Badge label="Recommended for you" />

            <Text
              style={[
                typography.h2,
                { color: colors.text, marginTop: spacing.md },
              ]}
            >
              {recommendation.name}
            </Text>

            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.sm },
              ]}
            >
              {recommendation.description}
            </Text>

            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginTop: spacing.md },
              ]}
            >
              {recommendation.daysPerWeek} days/week · ~{recommendation.estimatedMinutes} min
              sessions
            </Text>

            <Text
              style={[
                typography.bodySmall,
                { color: colors.textTertiary, marginTop: spacing.xs },
              ]}
            >
              {recommendation.repRangeNote}
            </Text>
          </Card>
        </ScrollView>

        {/* Bottom CTAs */}
        <View
          style={[
            styles.bottomCta,
            {
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.base,
              paddingTop: spacing.md,
              backgroundColor: colors.background,
              borderTopColor: colors.divider,
            },
          ]}
        >
          <Button
            title="Start Training"
            onPress={handleStartTraining}
            loading={isSaving}
            disabled={isSaving}
            size="lg"
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title="Browse All Programs"
            onPress={handleBrowsePrograms}
            variant="ghost"
            size="lg"
            loading={isSaving}
            disabled={isSaving}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  loadingText: {
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomCta: {
    borderTopWidth: 1,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
});
