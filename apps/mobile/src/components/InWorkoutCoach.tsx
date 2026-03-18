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
      const instanceId = resolveExerciseInstanceId(adj);
      if (!instanceId) return;

      if (adj.action === 'replace' && onReplaceExercise) {
        onReplaceExercise(instanceId, adj.exerciseName);
      } else if (adj.action === 'adjust_sets' && onAdjustSets) {
        onAdjustSets(instanceId, adj.sets, adj.reps);
      }

      setTrackedAdjustments((prev) =>
        prev.map((t, i) => (i === index ? { ...t, status: 'applied' } : t)),
      );
    },
    [trackedAdjustments, resolveExerciseInstanceId, onReplaceExercise, onAdjustSets],
  );

  const handleSkipAdjustment = useCallback((index: number) => {
    setTrackedAdjustments((prev) =>
      prev.map((t, i) => (i === index ? { ...t, status: 'skipped' } : t)),
    );
  }, []);

  const handleApplyAll = useCallback(() => {
    trackedAdjustments.forEach((tracked, index) => {
      if (tracked.status !== 'pending') return;
      const adj = tracked.adjustment;
      const instanceId = resolveExerciseInstanceId(adj);
      if (!instanceId) return;

      if (adj.action === 'replace' && onReplaceExercise) {
        onReplaceExercise(instanceId, adj.exerciseName);
      } else if (adj.action === 'adjust_sets' && onAdjustSets) {
        onAdjustSets(instanceId, adj.sets, adj.reps);
      }
    });

    setTrackedAdjustments((prev) =>
      prev.map((t) => (t.status === 'pending' ? { ...t, status: 'applied' } : t)),
    );
  }, [trackedAdjustments, resolveExerciseInstanceId, onReplaceExercise, onAdjustSets]);

  const handleDismissAdjustments = useCallback(() => {
    setTrackedAdjustments([]);
  }, []);

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

  if (activeSession && activeSession.exercises.filter((e) => !e.isSkipped).length > 1) {
    quickPrompts.push('Replace all dumbbell exercises with barbell');
  }

  const handleClose = () => {
    setResponse('');
    setCustomInput('');
    setTrackedAdjustments([]);
    onClose();
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
              {trackedAdjustments.map((tracked, index) => {
                const adj = tracked.adjustment;
                const isApplied = tracked.status === 'applied';
                const isSkipped = tracked.status === 'skipped';
                const isPending = tracked.status === 'pending';

                return (
                  <View
                    key={index}
                    style={[
                      styles.adjustmentCard,
                      {
                        backgroundColor: isApplied
                          ? colors.successLight
                          : isSkipped
                            ? colors.surfaceSecondary
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
                    {adj.action === 'replace' ? (
                      <>
                        <View style={styles.adjustmentHeader}>
                          <Ionicons
                            name={isApplied ? 'checkmark-circle' : 'swap-horizontal'}
                            size={18}
                            color={isApplied ? colors.success : colors.primary}
                          />
                          <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                            {isApplied ? 'Replaced' : isSkipped ? 'Skipped' : 'Replace'}
                          </Text>
                        </View>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                          {adj.currentExercise}  →  {adj.exerciseName}
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.adjustmentHeader}>
                          <Ionicons
                            name={isApplied ? 'checkmark-circle' : 'options'}
                            size={18}
                            color={isApplied ? colors.success : colors.primary}
                          />
                          <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                            {isApplied ? 'Adjusted' : isSkipped ? 'Skipped' : 'Adjust'} {adj.currentExercise}
                          </Text>
                        </View>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                          {adj.sets != null ? `${adj.sets} sets` : ''}
                          {adj.sets != null && adj.reps ? ' × ' : ''}
                          {adj.reps ? `${adj.reps} reps` : ''}
                        </Text>
                      </>
                    )}

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
                              backgroundColor: colors.success,
                              borderRadius: radius.md,
                              paddingHorizontal: spacing.md,
                              paddingVertical: spacing.xs,
                              flex: 1,
                            },
                          ]}
                        >
                          <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 3 }} />
                          <Text style={[typography.labelSmall, { color: '#fff' }]}>Apply</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Apply All / Dismiss buttons */}
              {pendingCount > 1 && (
                <TouchableOpacity
                  onPress={handleApplyAll}
                  style={[
                    styles.applyAllBtn,
                    {
                      backgroundColor: colors.success,
                      borderRadius: radius.md,
                      paddingVertical: spacing.sm,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: spacing.xs }} />
                  <Text style={[typography.label, { color: '#fff' }]}>Apply All ({pendingCount})</Text>
                </TouchableOpacity>
              )}

              {allResolved && (
                <View
                  style={[
                    styles.successBanner,
                    {
                      backgroundColor: colors.successLight,
                      borderRadius: radius.lg,
                      marginBottom: spacing.sm,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={[typography.label, { color: colors.success, marginLeft: spacing.sm }]}>
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
