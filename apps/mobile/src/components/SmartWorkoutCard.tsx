import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, typography, spacing } from '../theme';
import { useSmartWorkout } from '../hooks/useSmartWorkout';
import { useEntitlement } from '../hooks/useEntitlement';
import { usePaywall } from '../hooks/usePaywall';
import { useEntrance } from '../lib/animations';
import { Card } from './ui/Card';
import { BottomSheet } from './ui/BottomSheet';
import { ExerciseImage } from './workout/ExerciseImage';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';
import type { MuscleHighlight } from './MuscleAnatomyDiagram';
import { MuscleGroupPicker } from './MuscleGroupPicker';
import { MUSCLE_GROUPS } from './MuscleGroupTile';
import type { WorkoutGoal, SmartExercise, MuscleId, MuscleGroup as MuscleGroupType } from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface SmartWorkoutCardProps {
  onStartWorkout: () => void;
  onSwap: () => void;
  onCustomize: (muscleGroups: string[]) => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ── Constants ────────────────────────────────────────────────────────

const COMPACT_EXERCISE_COUNT = 3;
const FULL_EXERCISE_COUNT = 6;
const MENU_ICON_SIZE = 24;

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

const GOAL_LABELS: Record<WorkoutGoal, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  endurance: 'Endurance',
  general_fitness: 'General Fitness',
  weight_loss: 'Weight Loss',
};

const GOAL_ICONS: Record<WorkoutGoal, string> = {
  strength: 'barbell-outline',
  hypertrophy: 'trending-up-outline',
  endurance: 'timer-outline',
  general_fitness: 'fitness-outline',
  weight_loss: 'flame-outline',
};

/** Map target muscle name strings to MuscleId values for the anatomy diagram. */
function muscleNameToIds(name: string): MuscleId[] {
  const lower = name.toLowerCase();
  const group = MUSCLE_GROUPS.find(
    (g) => g.id === lower || g.label.toLowerCase() === lower,
  );
  if (group) return group.muscleIds;
  // Direct MuscleId match
  return [lower as MuscleId];
}

/** Detect front vs back view for a set of muscle IDs. */
const FRONT_MUSCLE_IDS: Set<MuscleId> = new Set([
  'pectoralis_major', 'pectoralis_minor',
  'deltoid_anterior', 'deltoid_lateral',
  'biceps', 'brachialis',
  'rectus_abdominis', 'obliques', 'transverse_abdominis',
  'quadriceps',
  'hip_flexors', 'adductors', 'abductors',
  'tibialis_anterior',
  'forearms',
]);

function detectView(muscleIds: MuscleId[]): 'front' | 'back' {
  let front = 0;
  let back = 0;
  for (const id of muscleIds) {
    if (FRONT_MUSCLE_IDS.has(id)) front++;
    else back++;
  }
  return front >= back ? 'front' : 'back';
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function getRecoveryColor(percent: number, colors: { success: string; warning: string; error: string }): string {
  if (percent >= 80) return colors.success;
  if (percent >= 50) return colors.warning;
  return colors.error;
}

// ── Shimmer Skeleton ────────────────────────────────────────────────

function ShimmerBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: 6,
          backgroundColor: colors.surfaceTertiary,
          opacity: shimmerAnim,
        },
        style,
      ]}
    />
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function SmartWorkoutCard({
  onStartWorkout,
  onSwap,
  onCustomize,
  compact = false,
  style,
}: SmartWorkoutCardProps) {
  const { colors, typography: typo, spacing, radius } = useTheme();
  const { workout, isGenerating, error, generate, start } = useSmartWorkout();
  const { canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();

  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuSubView, setMenuSubView] = useState<'main' | 'goal' | 'duration'>('main');

  // Staggered entrance animations
  const headerAnim = useEntrance(0);
  const pillsAnim = useEntrance(60);
  const musclesAnim = useEntrance(120);
  const explanationAnim = useEntrance(180);
  const exercisesAnim = useEntrance(240);
  const ctaAnim = useEntrance(300);

  const handleStart = useCallback(() => {
    onStartWorkout();
  }, [onStartWorkout]);

  const gatedGenerate = useCallback(
    (opts?: Parameters<typeof generate>[0]) => {
      if (!canAccess('unlimited_ai')) {
        showPaywall({ feature: 'unlimited_ai', source: 'smart_workout' });
        return;
      }
      generate(opts);
    },
    [canAccess, showPaywall, generate],
  );

  const handleCustomizeSave = useCallback(
    (groups: string[]) => {
      setSelectedMuscles(groups);
      onCustomize(groups);
    },
    [onCustomize],
  );

  const openCustomize = useCallback(() => {
    setSelectedMuscles(workout?.targetMuscles ?? []);
    setPickerVisible(true);
  }, [workout]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    setMenuSubView('main');
  }, []);

  const handleRegenerate = useCallback(() => {
    closeMenu();
    gatedGenerate({ forceRefresh: true });
  }, [closeMenu, gatedGenerate]);

  const handleMenuCustomize = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      setSelectedMuscles(workout?.targetMuscles ?? []);
      setPickerVisible(true);
    }, 150);
  }, [closeMenu, workout]);

  const handleGoalSelect = useCallback(
    (goal: WorkoutGoal) => {
      closeMenu();
      gatedGenerate({ goal, forceRefresh: true });
    },
    [closeMenu, gatedGenerate],
  );

  const handleDurationSelect = useCallback(
    (minutes: number) => {
      closeMenu();
      gatedGenerate({ availableMinutes: minutes, forceRefresh: true });
    },
    [closeMenu, gatedGenerate],
  );

  // ── Loading State ───────────────────────────────────────────────
  if (isGenerating) {
    return (
      <Card variant="hero" style={style}>
        <View style={styles.loadingHeader}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={[typo.label, { color: colors.primary, marginLeft: spacing.sm }]}>
            Generating your workout…
          </Text>
        </View>
        <View style={{ gap: spacing.md, marginTop: spacing.base }}>
          <ShimmerBlock width="60%" height={22} />
          <ShimmerBlock width="40%" height={16} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <ShimmerBlock width={80} height={32} style={{ borderRadius: radius.full }} />
            <ShimmerBlock width={100} height={32} style={{ borderRadius: radius.full }} />
            <ShimmerBlock width={44} height={32} style={{ borderRadius: radius.full }} />
          </View>
          <ShimmerBlock width="100%" height={60} style={{ marginTop: spacing.sm }} />
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <ShimmerBlock width={48} height={48} style={{ borderRadius: radius.md }} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <ShimmerBlock width="70%" height={16} />
                <ShimmerBlock width="30%" height={14} />
              </View>
            </View>
          ))}
          <ShimmerBlock width="100%" height={50} style={{ borderRadius: radius.md, marginTop: spacing.sm }} />
        </View>
      </Card>
    );
  }

  // ── Error State ────────────────────────────────────────────────
  if (error) {
    return (
      <Card variant="hero" style={style}>
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={[typo.body, { color: colors.text, textAlign: 'center', marginTop: spacing.md }]}>
            Couldn't generate your workout.
          </Text>
          <Pressable
            onPress={() => gatedGenerate()}
            style={[
              styles.retryButton,
              { backgroundColor: colors.errorLight, borderRadius: radius.md, marginTop: spacing.base },
            ]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.error} />
            <Text style={[typo.label, { color: colors.error, marginLeft: spacing.sm }]}>
              Tap to retry
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  // ── Empty State ────────────────────────────────────────────────
  if (!workout) {
    return (
      <Card variant="hero" style={style}>
        <View style={styles.centeredState}>
          <Ionicons name="barbell-outline" size={40} color={colors.textTertiary} />
          <Text style={[typo.h3, { color: colors.text, marginTop: spacing.base }]}>
            Ready for a workout?
          </Text>
          <Text style={[typo.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            Generate a personalized workout tailored to your recovery and goals.
          </Text>
          <Pressable
            onPress={() => gatedGenerate()}
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg },
            ]}
          >
            <Ionicons name="sparkles" size={18} color={colors.textInverse} />
            <Text style={[typo.label, { color: colors.textInverse, marginLeft: spacing.sm }]}>
              Generate Workout
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  // ── Rest Day State ─────────────────────────────────────────────
  if (workout.isRestDay) {
    return (
      <Card variant="hero" style={style}>
        <Animated.View style={headerAnim.animatedStyle}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="leaf-outline" size={22} color={colors.success} />
                <Text style={[typo.h2, { color: colors.text }]}>Rest Day</Text>
              </View>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                Active recovery recommended
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* AI Explanation */}
        <Animated.View style={[explanationAnim.animatedStyle, { marginTop: spacing.base }]}>
          <View
            style={[
              styles.explanationCard,
              { backgroundColor: colors.successLight, borderRadius: radius.md },
            ]}
          >
            <Ionicons name="sparkles" size={16} color={colors.success} style={{ marginTop: 2 }} />
            <Text
              style={[
                typo.bodySmall,
                { color: colors.textSecondary, fontStyle: 'italic', flex: 1, marginLeft: spacing.sm },
              ]}
            >
              {workout.aiExplanation}
            </Text>
          </View>
        </Animated.View>

        {/* Light activity suggestions */}
        <Animated.View style={[exercisesAnim.animatedStyle, { marginTop: spacing.base }]}>
          {workout.exercises.map((ex) => (
            <ExerciseRow key={ex.exerciseId} exercise={ex} colors={colors} typo={typo} spacing={spacing} radius={radius} />
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[ctaAnim.animatedStyle, { marginTop: spacing.lg }]}>
          <Pressable
            onPress={handleStart}
            style={[
              styles.primaryButton,
              { backgroundColor: colors.success, borderRadius: radius.md },
            ]}
          >
            <Ionicons name="walk-outline" size={20} color={colors.textInverse} />
            <Text style={[typo.labelLarge, { color: colors.textInverse, marginLeft: spacing.sm }]}>
              Start Active Recovery
            </Text>
          </Pressable>
        </Animated.View>
      </Card>
    );
  }

  // ── Main Workout State ─────────────────────────────────────────

  const maxExercises = compact ? COMPACT_EXERCISE_COUNT : FULL_EXERCISE_COUNT;
  const visibleExercises = workout.exercises.slice(0, maxExercises);
  const remainingCount = workout.exercises.length - visibleExercises.length;

  // Build muscle highlights for the scrollable tiles
  const muscleHighlights = workout.targetMuscles.map((name) => {
    const ids = muscleNameToIds(name);
    const recovery = workout.recoveryStatus[name] ?? 100;
    return { name, ids, recovery };
  });

  return (
    <Card variant="hero" style={style}>
      {/* ── 1. Header Row ────────────────────────────────────── */}
      <Animated.View style={headerAnim.animatedStyle}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typo.h2, { color: colors.text }]}>Up Next</Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {workout.exercises.length} Exercises
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={onSwap}
              style={[
                styles.swapPill,
                { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full },
              ]}
              hitSlop={8}
            >
              <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
              <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                Swap
              </Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.menuButton}
              onPress={() => setShowMenu(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ── 2. Filter Pills Row ───────────────────────────────── */}
      <Animated.View style={[pillsAnim.animatedStyle, { marginTop: spacing.md }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {/* Duration pill */}
          <Pressable
            onPress={() => setDurationPickerVisible((v) => !v)}
            style={[
              styles.filterPill,
              { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full },
            ]}
          >
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[typo.labelSmall, { color: colors.text, marginLeft: 4 }]}>
              {formatDuration(workout.estimatedDurationMinutes)}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textTertiary} style={{ marginLeft: 2 }} />
          </Pressable>

          {/* Goal pill */}
          <View
            style={[
              styles.filterPill,
              { backgroundColor: colors.primaryMuted, borderRadius: radius.full },
            ]}
          >
            <Ionicons
              name={(GOAL_ICONS[workout.goal] ?? 'fitness-outline') as any}
              size={14}
              color={colors.primary}
            />
            <Text style={[typo.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
              {GOAL_LABELS[workout.goal] ?? workout.goal}
            </Text>
          </View>

          {/* Total sets */}
          <View
            style={[
              styles.filterPill,
              { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full },
            ]}
          >
            <Text style={[typo.labelSmall, { color: colors.text }]}>
              {workout.totalSets} Sets
            </Text>
          </View>
        </ScrollView>

        {/* Duration quick-picker dropdown */}
        {durationPickerVisible && (
          <View
            style={[
              styles.durationDropdown,
              {
                backgroundColor: colors.surfaceTertiary,
                borderRadius: radius.md,
                borderColor: colors.border,
                marginTop: spacing.sm,
              },
            ]}
          >
            {DURATION_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => {
                  setDurationPickerVisible(false);
                  if (d !== workout.estimatedDurationMinutes) {
                    gatedGenerate({ availableMinutes: d, forceRefresh: true });
                  }
                }}
                style={[
                  styles.durationOption,
                  d === workout.estimatedDurationMinutes && { backgroundColor: colors.primaryMuted },
                ]}
              >
                <Text
                  style={[
                    typo.label,
                    {
                      color:
                        d === workout.estimatedDurationMinutes ? colors.primary : colors.text,
                    },
                  ]}
                >
                  {formatDuration(d)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>

      {/* ── 3. Target Muscles Section ─────────────────────────── */}
      <Animated.View style={[musclesAnim.animatedStyle, { marginTop: spacing.base }]}>
        <Text style={[typo.overline, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
          TARGET MUSCLES
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md }}
        >
          {muscleHighlights.map((m) => {
            const highlights: MuscleHighlight[] = m.ids.map((id) => ({
              muscleId: id,
              state: 'targeted' as const,
              opacity: 1,
            }));
            const view = detectView(m.ids);
            return (
              <View key={m.name} style={styles.muscleTile}>
                <MuscleAnatomyDiagram
                  view={view}
                  highlights={highlights}
                  variant="mini"
                  width={48}
                  height={48}
                  colorMode="brand"
                />
                <Text
                  numberOfLines={1}
                  style={[typo.labelSmall, { color: colors.text, marginTop: spacing.xs, textAlign: 'center' }]}
                >
                  {m.name}
                </Text>
                <Text
                  style={[
                    typo.micro,
                    { color: getRecoveryColor(m.recovery, colors), textAlign: 'center', marginTop: 1 },
                  ]}
                >
                  {Math.round(m.recovery)}%
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── 4. AI Explanation ─────────────────────────────────── */}
      <Animated.View style={[explanationAnim.animatedStyle, { marginTop: spacing.base }]}>
        <View
          style={[
            styles.explanationCard,
            { backgroundColor: colors.primaryMuted, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="sparkles" size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text
            style={[
              typo.bodySmall,
              { color: colors.textSecondary, fontStyle: 'italic', flex: 1, marginLeft: spacing.sm },
            ]}
          >
            {workout.aiExplanation}
          </Text>
        </View>
      </Animated.View>

      {/* ── 5. Exercise Preview List ─────────────────────────── */}
      <Animated.View style={[exercisesAnim.animatedStyle, { marginTop: spacing.base }]}>
        {visibleExercises.map((ex) => (
          <ExerciseRow key={ex.exerciseId} exercise={ex} colors={colors} typo={typo} spacing={spacing} radius={radius} />
        ))}
        {remainingCount > 0 && (
          <Text
            style={[
              typo.labelSmall,
              { color: colors.primary, marginTop: spacing.sm, textAlign: 'center' },
            ]}
          >
            +{remainingCount} more exercise{remainingCount !== 1 ? 's' : ''}
          </Text>
        )}
      </Animated.View>

      {/* ── 6. Start Workout CTA ─────────────────────────────── */}
      <Animated.View style={[ctaAnim.animatedStyle, { marginTop: spacing.lg }]}>
        <Pressable
          onPress={handleStart}
          style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}
        >
          <Text style={[typo.labelLarge, { color: colors.textInverse }]}>
            Start Workout
          </Text>
        </Pressable>
      </Animated.View>

      {/* ── 7. Customize Link ────────────────────────────────── */}
      <Animated.View style={[ctaAnim.animatedStyle, { marginTop: spacing.md }]}>
        <Pressable onPress={openCustomize} hitSlop={8} style={styles.customizeLink}>
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={[typo.label, { color: colors.primary, marginLeft: spacing.xs }]}>
            Customize Muscles
          </Text>
        </Pressable>
      </Animated.View>

      {/* Smart Workout Menu Sheet */}
      <BottomSheet visible={showMenu} onClose={closeMenu} scrollable={false} maxHeight={0.55}>
        {/* Header */}
        <View style={styles.menuSheetHeader}>
          {menuSubView !== 'main' ? (
            <TouchableOpacity
              onPress={() => setMenuSubView('main')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.menuSheetBackButton}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.menuSheetHeaderSpacer} />
          )}
          <Text
            style={[typo.h3, { color: colors.text, flex: 1, textAlign: 'center' }]}
            numberOfLines={1}
          >
            {menuSubView === 'goal'
              ? 'Change Goal'
              : menuSubView === 'duration'
                ? 'Change Duration'
                : 'Workout Options'}
          </Text>
          <TouchableOpacity
            onPress={closeMenu}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.menuSheetCloseButton}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />

        {menuSubView === 'main' && (
          <>
            {/* Regenerate Workout */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleRegenerate}
              style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="refresh-outline" size={MENU_ICON_SIZE} color={colors.textSecondary} />
              <Text style={[styles.menuRowText, { color: colors.text }]}>Regenerate Workout</Text>
            </TouchableOpacity>

            <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />

            {/* Customize Muscles */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={handleMenuCustomize}
              style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="options-outline" size={MENU_ICON_SIZE} color={colors.textSecondary} />
              <Text style={[styles.menuRowText, { color: colors.text }]}>Customize Muscles</Text>
            </TouchableOpacity>

            <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />

            {/* Change Goal */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => setMenuSubView('goal')}
              style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="trophy-outline" size={MENU_ICON_SIZE} color={colors.textSecondary} />
              <Text style={[styles.menuRowText, { color: colors.text, flex: 1 }]}>Change Goal</Text>
              <Text style={[styles.menuRowHint, { color: colors.textTertiary }]}>
                {GOAL_LABELS[workout.goal] ?? workout.goal}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />

            {/* Change Duration */}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => setMenuSubView('duration')}
              style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
            >
              <Ionicons name="time-outline" size={MENU_ICON_SIZE} color={colors.textSecondary} />
              <Text style={[styles.menuRowText, { color: colors.text, flex: 1 }]}>Change Duration</Text>
              <Text style={[styles.menuRowHint, { color: colors.textTertiary }]}>
                {formatDuration(workout.estimatedDurationMinutes)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </>
        )}

        {menuSubView === 'goal' && (
          <>
            {(Object.keys(GOAL_LABELS) as WorkoutGoal[]).map((goal, index) => (
              <React.Fragment key={goal}>
                {index > 0 && (
                  <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />
                )}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => handleGoalSelect(goal)}
                  style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
                >
                  <Ionicons
                    name={(GOAL_ICONS[goal] ?? 'fitness-outline') as any}
                    size={MENU_ICON_SIZE}
                    color={goal === workout.goal ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.menuRowText,
                      { color: goal === workout.goal ? colors.primary : colors.text },
                    ]}
                  >
                    {GOAL_LABELS[goal]}
                  </Text>
                  {goal === workout.goal && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </>
        )}

        {menuSubView === 'duration' && (
          <>
            {DURATION_OPTIONS.map((d, index) => (
              <React.Fragment key={d}>
                {index > 0 && (
                  <View style={[styles.menuSeparator, { backgroundColor: colors.border }]} />
                )}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => handleDurationSelect(d)}
                  style={[styles.menuRow, { paddingHorizontal: spacing.md }]}
                >
                  <Ionicons
                    name="time-outline"
                    size={MENU_ICON_SIZE}
                    color={d === workout.estimatedDurationMinutes ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.menuRowText,
                      {
                        color:
                          d === workout.estimatedDurationMinutes ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {formatDuration(d)}
                  </Text>
                  {d === workout.estimatedDurationMinutes && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </>
        )}
      </BottomSheet>

      {/* Muscle Group Picker Sheet */}
      <MuscleGroupPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        selectedGroups={selectedMuscles}
        onSelectionChange={setSelectedMuscles}
        onSave={handleCustomizeSave}
        recoveryData={workout.recoveryStatus}
      />
    </Card>
  );
}

// ── Exercise Row ────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  colors,
  typo,
  spacing,
  radius,
}: {
  exercise: SmartExercise;
  colors: any;
  typo: any;
  spacing: any;
  radius: any;
}) {
  return (
    <View
      style={[
        styles.exerciseRow,
        { borderBottomColor: colors.divider, paddingVertical: spacing.sm },
      ]}
    >
      <ExerciseImage
        exerciseId={exercise.exerciseId}
        variant="thumbnail"
        width={48}
        height={48}
        category={exercise.category as MuscleGroupType}
      />
      <View style={[styles.exerciseInfo, { marginLeft: spacing.md }]}>
        <Text numberOfLines={1} style={[typo.body, { color: colors.text }]}>
          {exercise.exerciseName}
        </Text>
        <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
          {exercise.targetSets}×{exercise.targetReps}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  swapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  menuButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: spacing['2xl'],
  },
  durationDropdown: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  durationOption: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  muscleTile: {
    alignItems: 'center',
    width: 72,
  },
  explanationCard: {
    flexDirection: 'row',
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 50,
  },
  customizeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  menuSheetHeaderSpacer: {
    width: 34,
  },
  menuSheetBackButton: {
    width: 34,
  },
  menuSheetCloseButton: {
    width: 34,
    alignItems: 'flex-end',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    gap: spacing.md,
  },
  menuRowText: {
    fontSize: 16,
  },
  menuRowHint: {
    fontSize: 13,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
  },
});
