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
  const [adjustment, setAdjustment] = useState<ExerciseAdjustment | null>(null);
  const [applied, setApplied] = useState(false);

  // Derive current exercise name from session or prop
  const currentExercise = activeSession
    ? activeSession.exercises[activeSession.currentExerciseIndex]
    : null;
  const currentExerciseName = currentExercise?.exerciseName ?? exerciseName;
  const currentExerciseInstanceId = currentExercise?.id;

  const handleSend = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;
      setIsLoading(true);
      setResponse('');
      setAdjustment(null);
      setApplied(false);
      setCustomInput('');

      try {
        // Determine if this is an adjustment request with a known exercise
        const shouldUseAdjustment =
          currentExerciseName &&
          exerciseLibrary &&
          exerciseLibrary.length > 0 &&
          isAdjustmentRequest(message);

        if (shouldUseAdjustment) {
          const result = await requestExerciseAdjustment(
            currentExerciseName!,
            exerciseLibrary!.map((e) => e.name),
            message,
          );
          setResponse(result.content);
          setAdjustment(result.adjustment);
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
    [currentExerciseName, exerciseLibrary, isLoading],
  );

  const handleApplyAdjustment = useCallback(() => {
    if (!adjustment || !currentExerciseInstanceId) return;

    if (adjustment.action === 'replace' && onReplaceExercise) {
      onReplaceExercise(currentExerciseInstanceId, adjustment.exerciseName);
      setApplied(true);
    } else if (adjustment.action === 'adjust_sets' && onAdjustSets) {
      onAdjustSets(currentExerciseInstanceId, adjustment.sets, adjustment.reps);
      setApplied(true);
    }
  }, [adjustment, currentExerciseInstanceId, onReplaceExercise, onAdjustSets]);

  const handleDismissAdjustment = useCallback(() => {
    setAdjustment(null);
  }, []);

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

  const handleClose = () => {
    setResponse('');
    setCustomInput('');
    setAdjustment(null);
    setApplied(false);
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

          {/* ── Adjustment Suggestion Card ──────────────────────────── */}
          {adjustment && !applied && (
            <View
              style={[
                styles.adjustmentCard,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing.base,
                  marginBottom: spacing.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.primary,
                },
              ]}
            >
              {adjustment.action === 'replace' ? (
                <>
                  <View style={styles.adjustmentHeader}>
                    <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                    <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                      Replace Exercise
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                    {currentExerciseName}  →  {adjustment.exerciseName}
                  </Text>
                  {adjustment.reason ? (
                    <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                      {adjustment.reason}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.adjustmentHeader}>
                    <Ionicons name="options" size={18} color={colors.primary} />
                    <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                      Adjust Sets/Reps
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                    {adjustment.sets != null ? `${adjustment.sets} sets` : ''}
                    {adjustment.sets != null && adjustment.reps ? ' × ' : ''}
                    {adjustment.reps ? `${adjustment.reps} reps` : ''}
                  </Text>
                  {adjustment.reason ? (
                    <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs, fontStyle: 'italic' }]}>
                      {adjustment.reason}
                    </Text>
                  ) : null}
                </>
              )}

              {/* Action buttons */}
              <View style={[styles.adjustmentActions, { marginTop: spacing.md }]}>
                <TouchableOpacity
                  onPress={handleDismissAdjustment}
                  style={[
                    styles.adjustmentBtn,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      marginRight: spacing.sm,
                    },
                  ]}
                >
                  <Text style={[typography.label, { color: colors.textSecondary }]}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleApplyAdjustment}
                  style={[
                    styles.adjustmentBtn,
                    {
                      backgroundColor: colors.success,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      flex: 1,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={[typography.label, { color: '#fff' }]}>Apply Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Success Message ─────────────────────────────────────── */}
          {applied && (
            <View
              style={[
                styles.successBanner,
                {
                  backgroundColor: colors.successLight,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing.base,
                  marginBottom: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[typography.label, { color: colors.success, marginLeft: spacing.sm }]}>
                Change applied!
              </Text>
            </View>
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
