import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from '../ui';
import { CoachAvatar } from './CoachAvatar';
import { CoachMarkdown } from './CoachMarkdown';
import { WorkoutPlanCard } from './WorkoutPlanCard';
import { NutritionCard } from './NutritionCard';
import { MealAnalysisCard } from './MealAnalysisCard';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { getActionDescription } from '../../lib/coach-actions';
import type { CoachMessage, CoachActionState } from '../../stores/coach-store';
import type { CoachAction } from '../../lib/coach-actions';

interface ChatBubbleProps {
  message: CoachMessage;
  onExecuteAction?: (messageId: string, actionIndex: number) => void;
  isStreaming?: boolean;
}

export function ChatBubble({ message, onExecuteAction, isStreaming }: ChatBubbleProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatarWrapper}>
          <CoachAvatar size={32} />
        </View>
      )}
      <View style={{ maxWidth: '80%' }}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isUser ? colors.primary : colors.surface,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: isUser ? 0 : 1,
              borderColor: colors.borderLight,
            },
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {isUser ? (
            <>
              {message.imageUri && (
                <Image
                  source={{ uri: message.imageUri }}
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: radius.md,
                    marginBottom: message.content ? spacing.sm : 0,
                  }}
                  resizeMode="cover"
                />
              )}
              {message.content ? (
                <Text
                  style={[
                    typography.body,
                    { color: colors.textInverse },
                  ]}
                >
                  {message.content}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <CoachMarkdown content={message.content} />
              {isStreaming && (
                <Text style={{ color: colors.primary, fontSize: 16, lineHeight: 20 }}>▌</Text>
              )}
            </>
          )}

          {/* Render structured content */}
          {message.structured_content?.map((content, index) => (
            <View key={index} style={{ marginTop: spacing.md }}>
              {content.type === 'workout_plan' && (
                <WorkoutPlanCard data={content.data} />
              )}
              {content.type === 'nutrition_summary' && (
                <NutritionCard data={content.data} />
              )}
              {content.type === 'meal_analysis' && (
                <MealAnalysisCard data={content.data} />
              )}
              {content.type === 'weekly_summary' && (
                <WeeklySummaryCard data={content.data} />
              )}
            </View>
          ))}

          <Text
            style={[
              typography.caption,
              {
                color: isUser ? 'rgba(255,255,255,0.6)' : colors.textTertiary,
                marginTop: spacing.xs,
              },
            ]}
          >
            {formatTime(message.created_at)}
          </Text>
        </View>

        {/* Render action cards below the bubble — now with ExpandableCard */}
        {!isUser && message.actions && message.actions.length > 0 && (
          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            {message.actions.map((actionState, index) => (
              <ActionCard
                key={index}
                actionState={actionState}
                onApply={() => onExecuteAction?.(message.id, index)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Action Card with ExpandableCard ──────────────────────────────────

interface ActionCardProps {
  actionState: CoachActionState;
  onApply: () => void;
}

function ActionCard({ actionState, onApply }: ActionCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const { status, message: resultMessage } = actionState;

  let description: string;
  try {
    description = getActionDescription(actionState.action);
  } catch {
    description = 'Apply change';
  }

  const isApplied = status === 'applied';
  const isFailed = status === 'failed';

  // For applied/failed actions, no expand needed — show simple card
  if (isApplied || isFailed) {
    return (
      <View
        style={[
          styles.actionCard,
          {
            backgroundColor: isApplied
              ? colors.successLight ?? `${colors.success}15`
              : colors.errorLight,
            borderRadius: radius.md,
            borderColor: isApplied ? colors.success : colors.error,
            padding: spacing.sm,
          },
        ]}
      >
        <View style={styles.actionContent}>
          <Ionicons
            name={isApplied ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={isApplied ? colors.success : colors.error}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text
              style={[
                typography.bodySmall,
                {
                  color: isApplied ? colors.success : colors.error,
                  fontWeight: '500',
                },
              ]}
              numberOfLines={2}
            >
              {description}
            </Text>
            {resultMessage && (
              <Text
                style={[
                  typography.caption,
                  {
                    color: isApplied ? colors.success : colors.error,
                    marginTop: 2,
                  },
                ]}
              >
                {resultMessage}
              </Text>
            )}
          </View>
          {isApplied && (
            <Ionicons name="checkmark-done" size={18} color={colors.success} />
          )}
        </View>
      </View>
    );
  }

  // Pending actions get ExpandableCard with detailed breakdown
  return (
    <ExpandableCard
      style={{
        borderColor: colors.border,
        borderRadius: radius.md,
      }}
      expandedContent={
        <ActionExpandedDetail action={actionState.action} onApply={onApply} />
      }
    >
      {/* Collapsed: icon + description + apply button */}
      <View style={styles.actionContent}>
        <Ionicons name="flash-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.text, fontWeight: '500' },
            ]}
            numberOfLines={2}
          >
            {description}
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            Tap to see details
          </Text>
        </View>
        <TouchableOpacity
          onPress={onApply}
          activeOpacity={0.7}
          style={[
            styles.applyButton,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.textInverse, fontSize: 12 }]}>
            Apply
          </Text>
        </TouchableOpacity>
      </View>
    </ExpandableCard>
  );
}

// ── Expanded Action Detail ───────────────────────────────────────────

function ActionExpandedDetail({
  action,
  onApply,
}: {
  action: CoachAction;
  onApply: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {/* Action type badge */}
      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            backgroundColor: colors.primaryMuted,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
            {formatActionType(action.type)}
          </Text>
        </View>
      </View>

      {/* Action-specific detail */}
      <ActionDetailContent action={action} />

      {/* Execute + Modify buttons */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={onApply}
          activeOpacity={0.7}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.label, { color: colors.textInverse }]}>
            Execute
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Action Detail Content (per-type breakdowns) ─────────────────────

function ActionDetailContent({ action }: { action: CoachAction }) {
  const { colors, spacing, typography } = useTheme();

  switch (action.type) {
    case 'update_targets': {
      const rows: Array<{ label: string; value: string }> = [];
      if (action.calories != null) rows.push({ label: 'Calories', value: `${action.calories} kcal` });
      if (action.protein != null) rows.push({ label: 'Protein', value: `${action.protein}g` });
      if (action.carbs != null) rows.push({ label: 'Carbs', value: `${action.carbs}g` });
      if (action.fat != null) rows.push({ label: 'Fat', value: `${action.fat}g` });
      if (action.fiber != null) rows.push({ label: 'Fiber', value: `${action.fiber}g` });
      if (action.water_oz != null) rows.push({ label: 'Water', value: `${action.water_oz} oz` });

      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            New Nutrition Targets
          </Text>
          {rows.map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{row.label}</Text>
              <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      );
    }

    case 'log_quick_meal':
      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Meal Details
          </Text>
          <DetailRow label="Name" value={action.name} />
          <DetailRow label="Calories" value={`${action.calories} kcal`} />
          {action.protein_g != null && <DetailRow label="Protein" value={`${action.protein_g}g`} />}
          {action.carbs_g != null && <DetailRow label="Carbs" value={`${action.carbs_g}g`} />}
          {action.fat_g != null && <DetailRow label="Fat" value={`${action.fat_g}g`} />}
          {action.mealType && <DetailRow label="Meal type" value={action.mealType} />}
        </View>
      );

    case 'create_weekly_plan': {
      const liftDays = action.days.filter((d) => d.dayType === 'lifting');
      const restDays = action.days.filter((d) => d.dayType !== 'lifting');
      const totalExercises = action.days.reduce((sum, d) => sum + d.exercises.length, 0);

      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Program Overview
          </Text>
          <DetailRow label="Name" value={action.name} />
          <DetailRow label="Difficulty" value={action.difficulty} />
          <DetailRow label="Lifting days" value={`${liftDays.length}`} />
          {restDays.length > 0 && <DetailRow label="Recovery days" value={`${restDays.length}`} />}
          <DetailRow label="Total exercises" value={`${totalExercises}`} />
          {liftDays.slice(0, 3).map((day) => (
            <Text key={day.dayNumber} style={[typography.caption, { color: colors.textSecondary }]}>
              Day {day.dayNumber}: {day.name} — {day.exercises.length} exercises
            </Text>
          ))}
          {liftDays.length > 3 && (
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              +{liftDays.length - 3} more days…
            </Text>
          )}
        </View>
      );
    }

    case 'generate_workout': {
      const exercises = action.exercises ?? [];
      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Workout Plan
          </Text>
          <DetailRow label="Name" value={action.name} />
          <DetailRow label="Exercises" value={`${exercises.length}`} />
          {exercises.slice(0, 4).map((e) => (
            <Text key={e.exerciseId} style={[typography.caption, { color: colors.textSecondary }]}>
              • {e.exerciseName} — {e.targetSets}×{e.targetReps}
            </Text>
          ))}
          {exercises.length > 4 && (
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              +{exercises.length - 4} more…
            </Text>
          )}
        </View>
      );
    }

    case 'swap_exercise':
      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Exercise Swap
          </Text>
          <DetailRow label="New exercise" value={action.newExerciseName ?? action.newExerciseId} />
        </View>
      );

    case 'add_exercise':
      return (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Add Exercise
          </Text>
          <DetailRow label="Exercise" value={action.exercise.exerciseName} />
          <DetailRow label="Sets × Reps" value={`${action.exercise.targetSets}×${action.exercise.targetReps}`} />
          <DetailRow label="Rest" value={`${action.exercise.restSeconds}s`} />
        </View>
      );

    case 'log_water':
      return (
        <View style={{ gap: spacing.xs }}>
          <DetailRow label="Amount" value={`${action.amount_oz} oz`} />
        </View>
      );

    default:
      return (
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          This action will be applied to your data.
        </Text>
      );
  }
}

// ── Shared detail row ────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatActionType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatarWrapper: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  bubble: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  userBubble: {
    marginLeft: 'auto',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    marginRight: 'auto',
    borderBottomLeftRadius: 4,
  },
  actionCard: {
    borderWidth: 1,
    marginLeft: 0,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applyButton: {
    marginLeft: 8,
  },
});
