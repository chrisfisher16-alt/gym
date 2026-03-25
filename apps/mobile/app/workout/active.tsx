import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useActiveWorkout } from '../../src/hooks/useActiveWorkout';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { useProfileStore } from '../../src/stores/profile-store';
import type { ActiveExercise, ExerciseLibraryEntry, CompletedSession } from '../../src/types/workout';
import { CommandCenterCard } from '../../src/components/workout/CommandCenterCard';
import { RestTimerOverlay } from '../../src/components/workout/RestTimerOverlay';
import { ExerciseReplacementModal } from '../../src/components/workout/ExerciseReplacementModal';
import { SupersetSelectionModal } from '../../src/components/workout/SupersetSelectionModal';
import { SupersetGroup, getSupersetType } from '../../src/components/workout/SupersetGroup';
import { WorkoutSummaryModal } from '../../src/components/workout/WorkoutSummaryModal';
import { SessionReplay } from '../../src/components/workout/SessionReplay';
import { InWorkoutCoach } from '../../src/components/InWorkoutCoach';
import { DrillDownView } from '../../src/components/workout/DrillDownView';
import { AmbientStatusBar } from '../../src/components/workout/AmbientStatusBar';
import { RewindOverlay } from '../../src/components/workout/RewindOverlay';
import { useWorkoutPhase } from '../../src/hooks/useWorkoutPhase';
import { useWorkoutUndo } from '../../src/hooks/useWorkoutUndo';
import ReanimatedAnimated, {
  SlideInRight,
  SlideOutRight,
  FadeIn,
  FadeOut,
  useReducedMotion,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';

import {
  getWorkoutFocus,
  getWarmupExerciseIds,
  getCooldownExerciseIds,
  hasWarmupExercises,
  getWarmupDescription,
  getCooldownDescription,
} from '../../src/lib/warmup-cooldown';
import { successNotification } from '../../src/lib/haptics';
import { incrementUsage } from '../../src/lib/usage-limits';

// Lazy-load native module (crashes on web)
let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

// Helper to navigate away without calling router during render
function NavigateAway({ router }: { router: ReturnType<typeof useRouter> }) {
  useEffect(() => {
    router.replace('/(tabs)/workout');
  }, [router]);
  return null;
}

// ── Main Screen ─────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    activeSession,
    isActive,
    elapsedDisplay,
    totalVolume,
    completedSets,
    completeWorkout,
    cancelWorkout,
    addExerciseToSession,
    prependExercisesToSession,
    replaceExercise,
    removeExerciseFromSession,
    createSupersetGroup,
    removeSupersetGroup,
    goToNextExercise,
    goToPreviousExercise,
    reorderExercises,
    logSet,
    completeSet,
    startRestTimer,
    setCurrentExerciseIndex,
    defaultRestSeconds,
    setDefaultRestSeconds,
  } = useActiveWorkout();

  // viewMode kept for potential future use but drill-down replaces focus
  const [viewMode] = useState<'full'>('full');
  const [swapModalExercise, setSwapModalExercise] = useState<ActiveExercise | null>(null);
  const [supersetSourceId, setSupersetSourceId] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  // Track which exercises have expanded inline preview in Command Center view
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingRest, setEditingRest] = useState(false);
  const [restInput, setRestInput] = useState('');
  const [showWarmupSuggestion, setShowWarmupSuggestion] = useState(false);
  const [showCooldownSuggestion, setShowCooldownSuggestion] = useState(false);
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const [cooldownDismissed, setCooldownDismissed] = useState(false);
  const [drilledExerciseIndex, setDrilledExerciseIndex] = useState<number | null>(null);

  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';
  const exerciseLibrary = useWorkoutStore((s) => s.exercises);
  const uncompleteSet = useWorkoutStore((s) => s.uncompleteSet);
  const workoutPhase = useWorkoutPhase();
  const reducedMotion = useReducedMotion();
  const isDrilledIn = drilledExerciseIndex !== null;

  // ── Undo System ─────────────────────────────────────────────────
  const { pushUndo, popUndo, canUndo, clearStack: clearUndoStack } = useWorkoutUndo();
  const [rewindDescription, setRewindDescription] = useState('');
  const [rewindVisible, setRewindVisible] = useState(false);

  // Shared value for two-finger swipe hint
  const hintOpacity = useSharedValue(0);
  const hintTranslateX = useSharedValue(0);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateX: hintTranslateX.value }],
  }));

  const performUndo = useCallback(() => {
    const action = popUndo();
    if (!action) return;
    action.undo();
    setRewindDescription(action.description);
    setRewindVisible(true);
  }, [popUndo]);

  const handleRewindComplete = useCallback(() => {
    setRewindVisible(false);
    setRewindDescription('');
  }, []);

  // Wrap completeSet to track undo-able actions
  const completeSetWithUndo = useCallback(
    (exerciseInstanceId: string, setId: string) => {
      // Capture pre-completion state for undo
      const exercise = activeSession?.exercises.find((e) => e.id === exerciseInstanceId);
      const set = exercise?.sets.find((s) => s.id === setId);
      if (!exercise || !set) {
        completeSet(exerciseInstanceId, setId);
        return;
      }

      const prevWeight = set.weight;
      const prevReps = set.reps;
      const exerciseName = exercise.exerciseName;
      const setNumber = set.setNumber;
      const weightLabel = prevWeight != null ? `${prevWeight}lb` : '';
      const repsLabel = prevReps != null ? `${prevReps}` : '';
      const detail = [weightLabel, repsLabel].filter(Boolean).join(' \u00D7 ');
      const description = `Completed Set ${setNumber} \u2014 ${exerciseName}${detail ? ` ${detail}` : ''}`;

      // Perform the action
      completeSet(exerciseInstanceId, setId);

      // Push undo entry
      pushUndo({
        id: `undo-${setId}-${Date.now()}`,
        description,
        timestamp: Date.now(),
        undo: () => {
          uncompleteSet(exerciseInstanceId, setId, {
            weight: prevWeight,
            reps: prevReps,
          });
        },
      });
    },
    [activeSession, completeSet, pushUndo, uncompleteSet],
  );

  // Two-finger swipe-left gesture for undo
  const rewindGesture = useMemo(() =>
    Gesture.Pan()
      .minPointers(2)
      .activeOffsetX(-30)
      .onUpdate((event) => {
        // Show hint proportional to drag distance
        const progress = Math.min(1, Math.abs(event.translationX) / 80);
        hintOpacity.value = progress;
        hintTranslateX.value = event.translationX * 0.3;
      })
      .onEnd((event) => {
        hintOpacity.value = withTiming(0, { duration: 200 });
        hintTranslateX.value = withTiming(0, { duration: 200 });
        if (event.translationX < -50) {
          runOnJS(performUndo)();
        }
      })
      .onFinalize(() => {
        hintOpacity.value = withTiming(0, { duration: 200 });
        hintTranslateX.value = withTiming(0, { duration: 200 });
      }),
    [performUndo, hintOpacity, hintTranslateX],
  );

  // Determine workout focus for contextual suggestions
  const workoutFocus = useMemo(
    () => activeSession ? getWorkoutFocus(activeSession.exercises, exerciseLibrary) : 'full_body' as const,
    [activeSession?.exercises, exerciseLibrary],
  );

  // Show warmup suggestion when workout starts (if no warmup exercises present).
  // hasWarmupExercises checks exercise library category, so previously-added
  // warmups are correctly detected even after screen remount.
  useEffect(() => {
    if (activeSession && !hasWarmupExercises(activeSession.exercises, exerciseLibrary)) {
      setShowWarmupSuggestion(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddWarmup = useCallback(() => {
    const warmupIds = getWarmupExerciseIds(workoutFocus);
    const warmupExercises = warmupIds
      .map((id) => exerciseLibrary.find((e) => e.id === id))
      .filter(Boolean) as ExerciseLibraryEntry[];
    if (warmupExercises.length > 0) {
      prependExercisesToSession(warmupExercises);
    }
    setShowWarmupSuggestion(false);
    setWarmupDismissed(true);
  }, [workoutFocus, exerciseLibrary, prependExercisesToSession]);

  const handleToggleExpand = useCallback((exerciseId: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }, []);

  const handleDeleteExercise = useCallback((exerciseInstanceId: string) => {
    const exercise = activeSession?.exercises.find((e) => e.id === exerciseInstanceId);
    if (!exercise) return;
    const name = exercise.exerciseName;
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${name} from this workout?`)) {
        removeExerciseFromSession(exerciseInstanceId);
      }
      return;
    }
    crossPlatformAlert('Delete Exercise', `Remove ${name} from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExerciseFromSession(exerciseInstanceId) },
    ]);
  }, [activeSession, removeExerciseFromSession]);

  const handleDismissWarmup = useCallback(() => {
    setShowWarmupSuggestion(false);
    setWarmupDismissed(true);
  }, []);

  const handleAddCooldown = useCallback(() => {
    const cooldownIds = getCooldownExerciseIds(workoutFocus);
    const cooldownExercises = cooldownIds
      .map((id) => exerciseLibrary.find((e) => e.id === id))
      .filter(Boolean) as ExerciseLibraryEntry[];
    for (const ex of cooldownExercises) {
      addExerciseToSession(ex, ex.defaultSets || 1, 'warmup');
    }
    setShowCooldownSuggestion(false);
    setCooldownDismissed(true);
  }, [workoutFocus, exerciseLibrary, addExerciseToSession]);

  const doFinish = async () => {
    clearUndoStack();
    // Set showReplay BEFORE completeWorkout — completeWorkout now awaits
    // AsyncStorage writes, but sets activeSession to null synchronously.
    // Without this flag already true, the !activeSession guard navigates away.
    setShowReplay(true);
    const result = await completeWorkout();
    if (result) {
      incrementUsage('workout_logs');
      successNotification();
      setCompletedSession(result);
    } else {
      setShowReplay(false);
      router.replace('/(tabs)/workout');
    }
  };

  const handleReplayComplete = () => {
    setShowReplay(false);
    setShowSummary(true);
  };

  const handleReplaySkip = () => {
    // Skip just fast-forwards the replay; "View Summary" still appears.
    // onComplete will transition to the summary modal.
  };

  const proceedToFinish = () => {
    if (!activeSession) return;

    // Count incomplete working sets across non-skipped exercises
    let incompleteSets = 0;
    let exercisesWithIncomplete = 0;
    for (const exercise of activeSession.exercises) {
      if (exercise.isSkipped) continue;
      const incompleteInExercise = exercise.sets.filter(
        (s) => s.setType !== 'warmup' && !s.isCompleted,
      ).length;
      if (incompleteInExercise > 0) {
        incompleteSets += incompleteInExercise;
        exercisesWithIncomplete++;
      }
    }

    if (incompleteSets > 0) {
      crossPlatformAlert(
        'Incomplete Sets',
        `You have ${incompleteSets} incomplete set${incompleteSets !== 1 ? 's' : ''} across ${exercisesWithIncomplete} exercise${exercisesWithIncomplete !== 1 ? 's' : ''}. Are you sure you want to finish?`,
        [
          { text: 'Keep Going', style: 'cancel' },
          { text: 'Finish Anyway', onPress: doFinish },
        ],
      );
    } else {
      crossPlatformAlert('Finish Workout', 'All sets completed. Finish this workout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ]);
    }
  };

  const handleFinish = () => {
    if (!activeSession) return;
    // Show cooldown suggestion only once; skip if already added or dismissed
    if (cooldownDismissed) {
      proceedToFinish();
      return;
    }
    setShowCooldownSuggestion(true);
  };

  const handleSummaryDone = () => {
    setShowSummary(false);
    setCompletedSession(null);
    router.replace('/(tabs)/workout');
  };

  const handleMinimize = () => {
    // Just navigate away — the session stays in activeSession (already persisted)
    router.push('/(tabs)/workout');
  };

  const handleDiscard = () => {
    crossPlatformAlert('Discard Workout', 'This will discard all progress. Are you sure?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clearUndoStack();
          cancelWorkout();
          router.replace('/(tabs)/workout');
        },
      },
    ]);
  };

  const [showCoach, setShowCoach] = useState(false);
  const addSet = useWorkoutStore((s) => s.addSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);

  const handleCoachReplaceExercise = useCallback(
    (exerciseInstanceIdOrName: string, newExerciseName: string) => {
      const libEntry = exerciseLibrary.find(
        (e) => e.name.toLowerCase() === newExerciseName.toLowerCase(),
      );
      if (!libEntry) return;

      // Try direct ID match first
      const directMatch = activeSession?.exercises.find((e) => e.id === exerciseInstanceIdOrName);
      if (directMatch) {
        replaceExercise(directMatch.id, libEntry);
        return;
      }

      // Fall back to matching by exercise name (for multi-adjust where AI sends exercise name)
      const nameMatch = activeSession?.exercises.find(
        (e) => e.exerciseName.toLowerCase() === exerciseInstanceIdOrName.toLowerCase() && !e.isSkipped,
      );
      if (nameMatch) {
        replaceExercise(nameMatch.id, libEntry);
      }
    },
    [exerciseLibrary, replaceExercise, activeSession],
  );

  const handleCoachAdjustSets = useCallback(
    (exerciseInstanceId: string, targetSets?: number, _reps?: string) => {
      if (!activeSession || targetSets == null) return;
      const exercise = activeSession.exercises.find((e) => e.id === exerciseInstanceId);
      if (!exercise) return;
      const currentSets = exercise.sets.length;
      if (targetSets > currentSets) {
        for (let i = 0; i < targetSets - currentSets; i++) {
          addSet(exerciseInstanceId, 'working');
        }
      } else if (targetSets < currentSets) {
        // Remove from the end (uncompleted sets first)
        const uncompleted = [...exercise.sets].reverse().filter((s) => !s.isCompleted);
        const toRemove = Math.min(currentSets - targetSets, uncompleted.length);
        for (let i = 0; i < toRemove; i++) {
          removeSet(exerciseInstanceId, uncompleted[i].id);
        }
      }
    },
    [activeSession, addSet, removeSet],
  );

  const handleCoachAddExercise = useCallback(
    (exerciseNameStr: string, sets: number, _reps: string) => {
      const libEntry = exerciseLibrary.find(
        (e) => e.name.toLowerCase() === exerciseNameStr.toLowerCase(),
      );
      if (!libEntry) return;
      addExerciseToSession(libEntry, sets, 'working');
    },
    [exerciseLibrary, addExerciseToSession],
  );

  const handleCoachRemoveExercise = useCallback(
    (exerciseInstanceId: string) => {
      removeExerciseFromSession(exerciseInstanceId);
    },
    [removeExerciseFromSession],
  );

  const handleCoachCreateSuperset = useCallback(
    (exerciseInstanceIds: string[]) => {
      if (exerciseInstanceIds.length >= 2) {
        createSupersetGroup(exerciseInstanceIds);
      }
    },
    [createSupersetGroup],
  );

  const handleAddExercise = () => {
    router.push('/workout/exercises');
  };

  const handleSwapSelect = useCallback(
    (newExercise: ExerciseLibraryEntry) => {
      if (swapModalExercise) {
        replaceExercise(swapModalExercise.id, newExercise);
      }
    },
    [swapModalExercise, replaceExercise],
  );

  const handleCreateSupersetGroup = useCallback(
    (selectedIds: string[]) => {
      createSupersetGroup(selectedIds);
    },
    [createSupersetGroup],
  );

  const handleRemoveSupersetGroup = useCallback(
    (groupId: string) => {
      removeSupersetGroup(groupId);
    },
    [removeSupersetGroup],
  );

  const handleMoveExercise = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (!activeSession) return;
      const exercises = activeSession.exercises;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= exercises.length) return;

      const newOrder = exercises.map((e) => e.id);
      // Swap
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      reorderExercises(newOrder);
      Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeSession, reorderExercises],
  );

  if (!activeSession) {
    // Show session replay before the summary modal
    if (showReplay && completedSession) {
      return (
        <SessionReplay
          session={completedSession}
          onComplete={handleReplayComplete}
          onSkip={handleReplaySkip}
        />
      );
    }
    if (showSummary && completedSession) {
      return <WorkoutSummaryModal visible={true} session={completedSession} onDone={handleSummaryDone} />;
    }
    // If we're in the process of finishing (showReplay/showSummary true but no session yet), show loading
    if (showReplay || showSummary) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.label, { color: colors.textSecondary, marginTop: 16 }]}>Saving workout...</Text>
          </View>
        </SafeAreaView>
      );
    }
    // Not in finish flow - navigate away (must be in useEffect, not during render)
    return <NavigateAway router={router} />;
  }

  // Build superset group info
  const supersetGroupMap = new Map<string, string[]>();
  activeSession.exercises.forEach((e) => {
    if (e.supersetGroupId) {
      const existing = supersetGroupMap.get(e.supersetGroupId) ?? [];
      existing.push(e.id);
      supersetGroupMap.set(e.supersetGroupId, existing);
    }
  });

  const getSupersetInfo = (exercise: ActiveExercise) => {
    if (!exercise.supersetGroupId) return { size: 0, label: '' };
    const members = supersetGroupMap.get(exercise.supersetGroupId) ?? [];
    const size = members.length;
    const label = size >= 3 ? 'Tri-Set' : 'Superset';
    return { size, label };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <AmbientStatusBar phase={workoutPhase} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingHorizontal: spacing.base, borderBottomColor: colors.borderLight }]}>
          <Pressable
            onPress={handleMinimize}
            onLongPress={handleDiscard}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Minimize workout"
          >
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              {activeSession.name}
            </Text>
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                {elapsedDisplay}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleFinish}
            style={[styles.finishBtn, { backgroundColor: colors.success, borderRadius: radius.md }]}
          >
            <Text style={[typography.labelSmall, { color: colors.textInverse }]}>Finish</Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={[styles.statsBar, { paddingHorizontal: spacing.base, paddingVertical: spacing.sm }]}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Sets: {completedSets}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Volume: {totalVolume.toLocaleString()} {unit}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Exercises: {activeSession.exercises.filter((e) => !e.isSkipped).length}
          </Text>
          {!isDrilledIn && (editingRest ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[
                  styles.restEditInput,
                  typography.bodySmall,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.primary,
                    borderRadius: radius.sm,
                  },
                ]}
                value={restInput}
                onChangeText={setRestInput}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => {
                  const val = parseInt(restInput, 10);
                  if (!isNaN(val) && val > 0) setDefaultRestSeconds(val);
                  setEditingRest(false);
                }}
                onBlur={() => {
                  const val = parseInt(restInput, 10);
                  if (!isNaN(val) && val > 0) setDefaultRestSeconds(val);
                  setEditingRest(false);
                }}
              />
              <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 2 }]}>s</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setRestInput(defaultRestSeconds.toString());
                setEditingRest(true);
              }}
            >
              <Text style={[typography.bodySmall, { color: colors.primary }]}>
                Rest: {defaultRestSeconds}s
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setIsReorderMode((prev) => !prev)}
            style={[
              styles.reorderToggle,
              {
                backgroundColor: isReorderMode ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Ionicons
              name="reorder-three"
              size={16}
              color={isReorderMode ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                typography.caption,
                {
                  color: isReorderMode ? colors.textInverse : colors.textSecondary,
                  marginLeft: 3,
                },
              ]}
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Exercise list (Command Center) — always rendered for scroll preservation */}
        <GestureDetector gesture={rewindGesture}>
        <View style={{ flex: 1 }}>
        {/* Two-finger swipe hint */}
        {canUndo && (
          <ReanimatedAnimated.View
            style={[
              styles.undoHint,
              hintStyle,
            ]}
            pointerEvents="none"
          >
            <Ionicons name="arrow-back" size={14} color={colors.textInverse} />
            <Text style={[typography.caption, { color: colors.textInverse, marginLeft: 4 }]}>Undo</Text>
          </ReanimatedAnimated.View>
        )}
        <ScrollView
          pointerEvents={isDrilledIn ? 'none' : 'auto'}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warmup suggestion card */}
          {showWarmupSuggestion && (
            <View
              style={[
                styles.warmupCard,
                {
                  backgroundColor: colors.primaryMuted,
                  borderRadius: radius.lg,
                  padding: spacing.base,
                  marginBottom: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Ionicons name="flame-outline" size={22} color={colors.primary} />
                <Text style={[typography.labelLarge, { color: colors.primary, marginLeft: spacing.sm }]}>
                  Warm Up First?
                </Text>
              </View>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {getWarmupDescription(workoutFocus)}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={handleAddWarmup}
                  style={[
                    styles.warmupBtn,
                    { backgroundColor: colors.primary, borderRadius: radius.md, flex: 1 },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.textInverse} />
                  <Text style={[typography.label, { color: colors.textInverse, marginLeft: 6 }]}>
                    Start Warmup
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDismissWarmup}
                  style={[
                    styles.warmupBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, flex: 1 },
                  ]}
                >
                  <Text style={[typography.label, { color: colors.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(() => {
            // Group consecutive exercises by supersetGroupId
            const groups: { groupId: string | null; items: { exercise: ActiveExercise; index: number }[] }[] = [];
            activeSession.exercises.forEach((exercise, index) => {
              const gid = exercise.supersetGroupId ?? null;
              const lastGroup = groups[groups.length - 1];
              if (lastGroup && lastGroup.groupId === gid && gid !== null) {
                lastGroup.items.push({ exercise, index });
              } else {
                groups.push({ groupId: gid, items: [{ exercise, index }] });
              }
            });

            return groups.map((group) => {
              if (group.groupId) {
                const memberExercises = group.items.map((g) => g.exercise);
                const type = getSupersetType(memberExercises.length);
                const roundCount = Math.min(...memberExercises.map((e) => e.sets.length));
                const minCompleted = Math.min(
                  ...memberExercises.map((e) => e.sets.filter((s) => s.isCompleted).length),
                );
                const currentRound = roundCount > 0 ? Math.min(minCompleted + 1, roundCount) : undefined;
                const isGroupActive = group.items.some(
                  (g) => g.index === activeSession.currentExerciseIndex,
                );

                return (
                  <SupersetGroup
                    key={group.groupId}
                    type={type}
                    roundCount={roundCount}
                    currentRound={currentRound}
                    isActive={isGroupActive}
                  >
                    {group.items.map((g) => (
                      <CommandCenterCard
                        key={g.exercise.id}
                        exercise={g.exercise}
                        exerciseIndex={g.index}
                        isCurrent={g.index === activeSession.currentExerciseIndex}
                        isExpanded={expandedExercises.has(g.exercise.id)}
                        onPress={() => {
                          setCurrentExerciseIndex(g.index);
                          setDrilledExerciseIndex(g.index);
                        }}
                        onToggleExpand={() => handleToggleExpand(g.exercise.id)}
                        onSetPress={() => {
                          setCurrentExerciseIndex(g.index);
                          setDrilledExerciseIndex(g.index);
                        }}
                      />
                    ))}
                  </SupersetGroup>
                );
              }

              // Non-superset exercises
              return group.items.map((g) => (
                <CommandCenterCard
                  key={g.exercise.id}
                  exercise={g.exercise}
                  exerciseIndex={g.index}
                  isCurrent={g.index === activeSession.currentExerciseIndex}
                  isExpanded={expandedExercises.has(g.exercise.id)}
                  onPress={() => {
                    setCurrentExerciseIndex(g.index);
                    setDrilledExerciseIndex(g.index);
                  }}
                  onToggleExpand={() => handleToggleExpand(g.exercise.id)}
                  onSetPress={() => {
                    setCurrentExerciseIndex(g.index);
                    setDrilledExerciseIndex(g.index);
                  }}
                />
              ));
            });
          })()}

          {/* Add Exercise button */}
          <TouchableOpacity
            onPress={handleAddExercise}
            style={[
              styles.addExerciseCard,
              { borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>
              Add Exercise
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Blur overlay — visionOS-style depth cue when drilled in */}
        {isDrilledIn && (
          <ReanimatedAnimated.View
            style={[StyleSheet.absoluteFill, styles.blurOverlay]}
            entering={FadeIn.duration(reducedMotion ? 0 : 300)}
            exiting={FadeOut.duration(reducedMotion ? 0 : 200)}
            pointerEvents="none"
          >
            {reducedMotion ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
            ) : (
              <BlurView
                intensity={20}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            )}
          </ReanimatedAnimated.View>
        )}

        {/* Drill Down view — slides in on top of blurred Command Center */}
        {isDrilledIn && activeSession.exercises[drilledExerciseIndex] && (
          <ReanimatedAnimated.View
            style={[StyleSheet.absoluteFill, styles.drillDownLayer]}
            entering={SlideInRight.duration(reducedMotion ? 0 : 250)}
            exiting={SlideOutRight.duration(reducedMotion ? 0 : 200)}
          >
            <DrillDownView
              activeSession={activeSession}
              exercise={activeSession.exercises[drilledExerciseIndex]}
              exerciseIndex={drilledExerciseIndex}
              totalExercises={activeSession.exercises.filter((e) => !e.isSkipped).length}
              onBack={() => setDrilledExerciseIndex(null)}
              onLogSet={logSet}
              onCompleteSet={completeSetWithUndo}
              onStartRestTimer={startRestTimer}
              onSetCurrentExerciseIndex={(idx) => {
                setCurrentExerciseIndex(idx);
                setDrilledExerciseIndex(idx);
              }}
              onNextExercise={() => {
                const nextIdx = drilledExerciseIndex + 1;
                if (nextIdx < activeSession.exercises.length) {
                  setCurrentExerciseIndex(nextIdx);
                  setDrilledExerciseIndex(nextIdx);
                }
              }}
              onFinishWorkout={handleFinish}
              onReplaceExercise={(ex) => setSwapModalExercise(ex)}
              supersetInfo={(() => {
                const ex = activeSession.exercises[drilledExerciseIndex];
                if (!ex.supersetGroupId) return undefined;
                const members = activeSession.exercises.filter(
                  (e) => e.supersetGroupId === ex.supersetGroupId && !e.isSkipped,
                );
                if (members.length <= 1) return undefined;
                const pos = members.findIndex((m) => m.id === ex.id) + 1;
                const nextIdx = pos % members.length;
                return {
                  groupId: ex.supersetGroupId,
                  position: pos,
                  total: members.length,
                  nextExerciseName: members[nextIdx]?.exerciseName,
                };
              })()}
            />
          </ReanimatedAnimated.View>
        )}
        </View>
        </GestureDetector>

        {/* Rewind Overlay */}
        <RewindOverlay
          description={rewindDescription}
          visible={rewindVisible}
          onComplete={handleRewindComplete}
        />

        {/* Bottom nav (hidden when drill-down is active) */}
        {drilledExerciseIndex === null && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderLight,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <TouchableOpacity
            onPress={goToPreviousExercise}
            style={[styles.navBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            disabled={activeSession.currentExerciseIndex === 0}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={activeSession.currentExerciseIndex === 0 ? colors.textTertiary : colors.text}
            />
            <Text
              style={[
                typography.labelSmall,
                {
                  color: activeSession.currentExerciseIndex === 0 ? colors.textTertiary : colors.text,
                  marginLeft: 4,
                },
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
            {activeSession.currentExerciseIndex + 1} / {activeSession.exercises.length}
          </Text>

          <TouchableOpacity
            onPress={goToNextExercise}
            style={[styles.navBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            disabled={activeSession.currentExerciseIndex >= activeSession.exercises.length - 1}
          >
            <Text
              style={[
                typography.labelSmall,
                {
                  color:
                    activeSession.currentExerciseIndex >= activeSession.exercises.length - 1
                      ? colors.textTertiary
                      : colors.text,
                  marginRight: 4,
                },
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                activeSession.currentExerciseIndex >= activeSession.exercises.length - 1
                  ? colors.textTertiary
                  : colors.text
              }
            />
          </TouchableOpacity>
        </View>
        )}

        {/* Rest Timer Overlay */}
        <RestTimerOverlay />

        {/* Exercise Replacement Modal */}
        <ExerciseReplacementModal
          visible={swapModalExercise !== null}
          exercise={swapModalExercise}
          onClose={() => setSwapModalExercise(null)}
          onSelect={handleSwapSelect}
        />

        {/* Coach Button */}
        <TouchableOpacity
          onPress={() => setShowCoach(true)}
          style={[
            styles.coachFab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.textInverse} />
        </TouchableOpacity>

        {/* In-Workout Coach */}
        <InWorkoutCoach
          visible={showCoach}
          onClose={() => setShowCoach(false)}
          activeSession={activeSession}
          exerciseLibrary={exerciseLibrary}
          onReplaceExercise={handleCoachReplaceExercise}
          onAdjustSets={handleCoachAdjustSets}
          onAddExercise={handleCoachAddExercise}
          onRemoveExercise={handleCoachRemoveExercise}
          onCreateSuperset={handleCoachCreateSuperset}
        />

        {/* Superset Selection Modal */}
        <SupersetSelectionModal
          visible={supersetSourceId !== null}
          sourceExerciseId={supersetSourceId ?? ''}
          exercises={activeSession.exercises}
          onClose={() => setSupersetSourceId(null)}
          onConfirm={handleCreateSupersetGroup}
        />

        {/* Cooldown Suggestion Modal */}
        <Modal
          visible={showCooldownSuggestion}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowCooldownSuggestion(false);
            setCooldownDismissed(true);
            proceedToFinish();
          }}
        >
          <View style={[styles.cooldownOverlay]}>
            <View
              style={[
                styles.cooldownCard,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 12,
                },
              ]}
            >
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                <Ionicons name="snow-outline" size={36} color={colors.info} />
                <Text style={[typography.displayMedium, { color: colors.text, marginTop: spacing.sm, textAlign: 'center', fontSize: 22 }]}>
                  Cool Down?
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }]}>
                {getCooldownDescription(workoutFocus)}
              </Text>
              <View style={{ gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={handleAddCooldown}
                  style={[
                    styles.cooldownBtn,
                    { backgroundColor: colors.info, borderRadius: radius.md },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.textInverse} />
                  <Text style={[typography.label, { color: colors.textInverse, marginLeft: 8 }]}>
                    Add Cooldown Exercises
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowCooldownSuggestion(false);
                    setCooldownDismissed(true);
                    proceedToFinish();
                  }}
                  style={[
                    styles.cooldownBtn,
                    { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                  ]}
                >
                  <Text style={[typography.label, { color: colors.textSecondary }]}>
                    Skip & Finish
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  finishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalFooter: {
    borderTopWidth: 1,
  },
  replacementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachFab: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50,
  },
  reorderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  restEditInput: {
    borderWidth: 1,
    textAlign: 'center',
    width: 44,
    minHeight: 28,
    paddingHorizontal: 4,
  },
  // Summary modal
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    width: '100%',
  },
  summaryStatCard: {
    alignItems: 'center',
    padding: 16,
    minWidth: 130,
    flex: 1,
  },
  prSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Warmup suggestion card
  warmupCard: {},
  warmupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  // Cooldown suggestion modal
  cooldownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  cooldownCard: {
    width: '85%',
    maxWidth: 380,
  },
  cooldownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  // Blur overlay for visionOS-style depth
  blurOverlay: {
    zIndex: 10,
  },
  drillDownLayer: {
    zIndex: 20,
  },
  // Undo hint that appears during two-finger swipe
  undoHint: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 30,
  },
});
