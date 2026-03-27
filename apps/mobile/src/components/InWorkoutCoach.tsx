import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { sendWorkoutQuickMessage } from '../lib/coach-api';
import {
  requestExerciseAdjustment,
  type ExerciseAdjustment,
} from '../lib/coach-api';
import type { ActiveWorkoutSession, ExerciseLibraryEntry } from '../types/workout';

// ── Types ──────────────────────────────────────────────────────────────

interface InWorkoutCoachProps {
  visible: boolean;
  onClose: () => void;
  /** @deprecated Pass activeSession instead for full context. */
  exerciseName?: string;
  /** The full active workout session – enables exercise adjustment features. */
  activeSession?: ActiveWorkoutSession | null;
  /** Available exercises from the library (needed for AI-powered replacements). */
  exerciseLibrary?: ExerciseLibraryEntry[];
  /** Called when the user applies an AI-suggested exercise replacement. */
  onReplaceExercise?: (exerciseInstanceId: string, newExerciseName: string) => void;
  /** Called when the user applies an AI-suggested set/rep adjustment. */
  onAdjustSets?: (exerciseInstanceId: string, sets?: number, reps?: string) => void;
  /** Called when the user applies an AI-suggested exercise addition. */
  onAddExercise?: (exerciseName: string, sets: number, reps: string) => void;
  /** Called when the user applies an AI-suggested exercise removal. */
  onRemoveExercise?: (exerciseInstanceId: string) => void;
  /** Called when the user applies an AI-suggested superset grouping. */
  onCreateSuperset?: (exerciseInstanceIds: string[]) => void;
}

// ── Per-adjustment status tracking ─────────────────────────────────────

type AdjustmentStatus = 'pending' | 'applied' | 'skipped';

interface TrackedAdjustment {
  adjustment: ExerciseAdjustment;
  status: AdjustmentStatus;
}

// ── Adjustment prompt keywords ─────────────────────────────────────────

const ADJUSTMENT_KEYWORDS = [
  'replace', 'swap', 'alternative', 'substitute', 'instead',
  'easier', 'harder', 'home', 'bodyweight', 'no equipment',
  'adjust', 'modify', 'change', 'make it',
  'add', 'more exercise', 'another exercise', 'extra exercise',
  'remove', 'drop', 'skip', 'take out', 'get rid of',
  'superset', 'super set', 'pair', 'back to back', 'back-to-back',
  'circuit', 'compound set',
];

function isAdjustmentRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return ADJUSTMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Component ──────────────────────────────────────────────────────────

export function InWorkoutCoach({
  visible,
  onClose,
  exerciseName,
  activeSession,
  exerciseLibrary,
  onReplaceExercise,
  onAdjustSets,
  onAddExercise,
  onRemoveExercise,
  onCreateSuperset,
}: InWorkoutCoachProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [customInput, setCustomInput] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trackedAdjustments, setTrackedAdjustments] = useState<TrackedAdjustment[]>([]);

  // Derive current exercise name from session or prop
  const currentExercise = activeSession
    ? activeSession.exercises[activeSession.currentExerciseIndex]
    : null;
  const currentExerciseName = currentExercise?.exerciseName ?? exerciseName;

  // Resolve exerciseInstanceId from a currentExercise name in the adjustment
  const resolveExerciseInstanceId = useCallback(
    (adj: ExerciseAdjustment): string | null => {
      if (!activeSession) return null;

      // For add_exercise and create_superset, there's no single target exercise
      if (adj.action === 'add_exercise') return null;
      if (adj.action === 'create_superset') return null;

      // Try to match by name
      const targetName = adj.currentExercise;
      if (targetName) {
        const match = activeSession.exercises.find(
          (e) => e.exerciseName.toLowerCase() === targetName.toLowerCase() && !e.isSkipped,
        );
        if (match) return match.id;
      }

      // Fall back to current exercise
      return currentExercise?.id ?? null;
    },
    [activeSession, currentExercise],
  );

  // Resolve multiple exercise instance IDs from names (for supersets)
  const resolveExerciseInstanceIds = useCallback(
    (exerciseNames: string[]): string[] => {
      if (!activeSession) return [];
      return exerciseNames
        .map((name) => {
          const match = activeSession.exercises.find(
            (e) => e.exerciseName.toLowerCase() === name.toLowerCase() && !e.isSkipped,
          );
          return match?.id;
        })
        .filter((id): id is string => !!id);
    },
    [activeSession],
  );

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;
      setIsLoading(true);
      setResponse('');
      setTrackedAdjustments([]);
      setCustomInput('');

      try {
        const shouldUseAdjustment =
          currentExerciseName &&
          exerciseLibrary &&
          exerciseLibrary.length > 0 &&
          isAdjustmentRequest(message);

        if (shouldUseAdjustment) {
          // Build workout exercises list for multi-adjust context
          const workoutExercises = activeSession
            ? activeSession.exercises
                .filter((e) => !e.isSkipped)
                .map((e) => ({ name: e.exerciseName, exerciseId: e.exerciseId }))
            : undefined;

          const result = await requestExerciseAdjustment(
            currentExerciseName!,
            exerciseLibrary!.map((e) => e.name),
            message,
            workoutExercises,
          );
          setResponse(result.content);
          if (result.adjustments.length > 0) {
            setTrackedAdjustments(
              result.adjustments.map((adj) => ({ adjustment: adj, status: 'pending' })),
            );
          }
        } else {
          const result = await sendWorkoutQuickMessage(message, currentExerciseName);
          setResponse(result.content);
        }
      } catch {
        setResponse('Sorry, I could not get a response right now. Try again in a moment.');
      } finally {
        setIsLoading(false);
      }
    },
    [currentExerciseName, exerciseLibrary, isLoading, activeSession],
  );

  const handleApplyAdjustment = useCallback(
    (index: number) => {
      const tracked = trackedAdjustments[index];
      if (!tracked || tracked.status !== 'pending') return;

      const adj = tracked.adjustment;

      if (adj.action === 'replace' && onReplaceExercise) {
        const instanceId = resolveExerciseInstanceId(adj);
        if (!instanceId) return;
        onReplaceExercise(instanceId, adj.exerciseName);
      } else if (adj.action === 'adjust_sets' && onAdjustSets) {
        const instanceId = resolveExerciseInstanceId(adj);
        if (!instanceId) return;
        onAdjustSets(instanceId, adj.sets, adj.reps);
      } else if (adj.action === 'add_exercise' && onAddExercise) {
        onAddExercise(adj.exerciseName, adj.sets, adj.reps);
      } else if (adj.action === 'remove_exercise' && onRemoveExercise) {
        const instanceId = resolveExerciseInstanceId(adj);
        if (!instanceId) return;
        onRemoveExercise(instanceId);
      } else if (adj.action === 'create_superset' && onCreateSuperset) {
        const instanceIds = resolveExerciseInstanceIds(adj.exercises);
        if (instanceIds.length < 2) return;
        onCreateSuperset(instanceIds);
      }

      setTrackedAdjustments((prev) =>
        prev.map((t, i) => (i === index ? { ...t, status: 'applied' } : t)),
      );
    },
    [trackedAdjustments, resolveExerciseInstanceId, resolveExerciseInstanceIds, onReplaceExercise, onAdjustSets, onAddExercise, onRemoveExercise, onCreateSuperset],
  );

  const handleSkipAdjustment = useCallback((index: number) => {
    setTrackedAdjustments((prev) =>
      prev.map((t, i) => (i === index ? { ...t, status: 'skipped' } : t)),
    );
  }, []);

  const handleApplyAll = useCallback(() => {
    trackedAdjustments.forEach((tracked, index) => {
      if (tracked.status !== 'pending') return;
      handleApplyAdjustment(index);
    });
  }, [trackedAdjustments, handleApplyAdjustment]);

  const pendingCount = trackedAdjustments.filter((t) => t.status === 'pending').length;
  const allResolved = trackedAdjustments.length > 0 && pendingCount === 0;

  // ── Quick prompts ─────────────────────────────────────────────────
  const quickPrompts: string[] = [];

  if (currentExerciseName) {
    quickPrompts.push(`Replace ${currentExerciseName} with a home alternative`);
    quickPrompts.push(`Make ${currentExerciseName} easier`);
    quickPrompts.push(`Make ${currentExerciseName} harder`);
    quickPrompts.push(`Form tips for ${currentExerciseName}`);
  } else {
    quickPrompts.push('Suggest an alternative exercise');
    quickPrompts.push('General form tips');
  }

  // Add exercise chip
  quickPrompts.push('Add two more exercises to this workout');

  // Superset chips
  if (activeSession && activeSession.exercises.filter((e) => !e.isSkipped).length >= 2) {
    quickPrompts.push('Suggest supersets for this workout');
    if (currentExerciseName) {
      quickPrompts.push(`Pair ${currentExerciseName} in a superset`);
    }
    quickPrompts.push('Replace all dumbbell exercises with barbell');
  }

  const handleClose = () => {
    setResponse('');
    setCustomInput('');
    setTrackedAdjustments([]);
    onClose();
  };

  // ── Render adjustment card ────────────────────────────────────────
  const renderAdjustmentCard = (tracked: TrackedAdjustment, index: number) => {
    const adj = tracked.adjustment;
    const isApplied = tracked.status === 'applied';
    const isSkipped = tracked.status === 'skipped';
    const isPending = tracked.status === 'pending';

    let icon: keyof typeof Ionicons.glyphMap = 'options';
    let label = '';
    let detail = '';

    if (adj.action === 'replace') {
      icon = isApplied ? 'checkmark-circle' : 'swap-horizontal';
      label = isApplied ? 'Replaced' : isSkipped ? 'Skipped' : 'Replace';
      detail = `${adj.currentExercise}  →  ${adj.exerciseName}`;
    } else if (adj.action === 'adjust_sets') {
      icon = isApplied ? 'checkmark-circle' : 'options';
      label = `${isApplied ? 'Adjusted' : isSkipped ? 'Skipped' : 'Adjust'} ${adj.currentExercise}`;
      const parts: string[] = [];
      if (adj.sets != null) parts.push(`${adj.sets} sets`);
      if (adj.reps) parts.push(`${adj.reps} reps`);
      detail = parts.join(' × ');
    } else if (adj.action === 'add_exercise') {
      icon = isApplied ? 'checkmark-circle' : 'add-circle';
      label = isApplied ? 'Added' : isSkipped ? 'Skipped' : 'Add Exercise';
      detail = `${adj.exerciseName} — ${adj.sets} sets × ${adj.reps} reps`;
    } else if (adj.action === 'remove_exercise') {
      icon = isApplied ? 'checkmark-circle' : 'remove-circle';
      label = isApplied ? 'Removed' : isSkipped ? 'Skipped' : 'Remove';
      detail = adj.currentExercise;
    } else if (adj.action === 'create_superset') {
      icon = isApplied ? 'checkmark-circle' : 'git-merge';
      label = isApplied ? 'Superset Created' : isSkipped ? 'Skipped' : 'Create Superset';
      detail = adj.exercises.join(' + ');
    }

    return (
      <View
        key={index}
        style={[
          styles.adjustmentCard,
          {
            backgroundColor: isApplied
              ? colors.completedMuted
              : colors.surfaceSecondary,
            borderRadius: radius.lg,
            marginBottom: spacing.sm,
            padding: spacing.md,
            borderWidth: isPending ? 1 : 0,
            borderColor: colors.primary,
            opacity: isSkipped ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.adjustmentHeader}>
          <Ionicons
            name={icon}
            size={18}
            color={isApplied ? colors.completed : colors.primary}
          />
          <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
            {label}
          </Text>
        </View>
        {detail ? (
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            {detail}
          </Text>
        ) : null}

        {adj.reason ? (
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
            {adj.reason}
          </Text>
        ) : null}

        {/* Per-item action buttons */}
        {isPending && (
          <View style={[styles.adjustmentActions, { marginTop: spacing.sm }]}>
            <TouchableOpacity
              onPress={() => handleSkipAdjustment(index)}
              style={[
                styles.adjustmentBtn,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  marginRight: spacing.sm,
                },
              ]}
            >
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleApplyAdjustment(index)}
              style={[
                styles.adjustmentBtn,
                {
                  backgroundColor: colors.completed,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  flex: 1,
                },
              ]}
            >
              <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} style={{ marginRight: 3 }} />
              <Text style={[typography.labelSmall, { color: colors.textOnPrimary }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: Platform.OS === 'ios' ? 34 : spacing.base,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
            <Ionicons name="fitness" size={20} color={colors.primary} />
            <Text style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
              Workout Coach
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {currentExerciseName && (
            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.textSecondary,
                  paddingHorizontal: spacing.base,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              Currently doing: {currentExerciseName}
            </Text>
          )}

          {/* Quick prompts */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.base,
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}
          >
            {quickPrompts.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                onPress={() => handleSend(prompt)}
                disabled={isLoading}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.xl,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    opacity: isLoading ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.primary }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Response area */}
          {(isLoading || response) && (
            <ScrollView
              style={[
                styles.responseArea,
                {
                  backgroundColor: colors.background,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing.base,
                  marginBottom: spacing.md,
                  padding: spacing.md,
                  maxHeight: 200,
                },
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                    Thinking...
                  </Text>
                </View>
              ) : (
                <Text style={[typography.bodySmall, { color: colors.text, lineHeight: 20 }]}>
                  {response}
                </Text>
              )}
            </ScrollView>
          )}

          {/* ── Multi-Adjustment List ─────────────────────────────── */}
          {trackedAdjustments.length > 0 && (
            <ScrollView
              style={{ maxHeight: 280 }}
              contentContainerStyle={{
                paddingHorizontal: spacing.base,
                paddingBottom: spacing.sm,
              }}
            >
              {trackedAdjustments.map((tracked, index) => renderAdjustmentCard(tracked, index))}

              {/* Apply All / Dismiss buttons */}
              {pendingCount > 1 && (
                <TouchableOpacity
                  onPress={handleApplyAll}
                  style={[
                    styles.applyAllBtn,
                    {
                      backgroundColor: colors.completed,
                      borderRadius: radius.md,
                      paddingVertical: spacing.sm,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-done" size={18} color={colors.textOnPrimary} style={{ marginRight: spacing.xs }} />
                  <Text style={[typography.label, { color: colors.textOnPrimary }]}>Apply All ({pendingCount})</Text>
                </TouchableOpacity>
              )}

              {allResolved && (
                <View
                  style={[
                    styles.successBanner,
                    {
                      backgroundColor: colors.completedMuted,
                      borderRadius: radius.lg,
                      marginBottom: spacing.sm,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={20} color={colors.completed} />
                  <Text style={[typography.label, { color: colors.completed, marginLeft: spacing.sm }]}>
                    All changes resolved!
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Custom input */}
          <View style={[styles.inputRow, { paddingHorizontal: spacing.base }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.xl,
                  paddingHorizontal: spacing.base,
                  paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
                  color: colors.text,
                  fontSize: 14,
                },
              ]}
              placeholder="Ask about this exercise..."
              placeholderTextColor={colors.textTertiary}
              value={customInput}
              onChangeText={setCustomInput}
              returnKeyType="send"
              onSubmitEditing={() => handleSend(customInput)}
              blurOnSubmit={false}
              onKeyPress={(e: any) => {
                if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault?.();
                  handleSend(customInput);
                }
              }}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => handleSend(customInput)}
              disabled={!customInput.trim() || isLoading}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    customInput.trim() && !isLoading ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.full,
                  marginLeft: spacing.sm,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={16}
                color={customInput.trim() && !isLoading ? colors.textInverse : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    paddingTop: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chip: {},
  responseArea: {},
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustmentCard: {},
  adjustmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
