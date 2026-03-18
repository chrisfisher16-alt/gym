import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { CoachAvatar } from './CoachAvatar';
import { WorkoutPlanCard } from './WorkoutPlanCard';
import { NutritionCard } from './NutritionCard';
import { MealAnalysisCard } from './MealAnalysisCard';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { getActionDescription } from '../../lib/coach-actions';
import type { CoachMessage, CoachActionState } from '../../stores/coach-store';

interface ChatBubbleProps {
  message: CoachMessage;
  onExecuteAction?: (messageId: string, actionIndex: number) => void;
}

export function ChatBubble({ message, onExecuteAction }: ChatBubbleProps) {
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
          <Text
            style={[
              typography.body,
              { color: isUser ? colors.textInverse : colors.text },
            ]}
          >
            {message.content}
          </Text>

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

        {/* Render action cards below the bubble */}
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

// ── Action Card ──────────────────────────────────────────────────────

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

  return (
    <View
      style={[
        styles.actionCard,
        {
          backgroundColor: isApplied
            ? colors.successLight ?? `${colors.success}15`
            : isFailed
              ? colors.errorLight
              : colors.surfaceSecondary,
          borderRadius: radius.md,
          borderColor: isApplied
            ? colors.success
            : isFailed
              ? colors.error
              : colors.border,
          padding: spacing.sm,
        },
      ]}
    >
      <View style={styles.actionContent}>
        <Ionicons
          name={
            isApplied
              ? 'checkmark-circle'
              : isFailed
                ? 'alert-circle'
                : 'flash-outline'
          }
          size={18}
          color={
            isApplied
              ? colors.success
              : isFailed
                ? colors.error
                : colors.primary
          }
        />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              typography.bodySmall,
              {
                color: isApplied
                  ? colors.success
                  : isFailed
                    ? colors.error
                    : colors.text,
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
        {status === 'pending' && (
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
        )}
        {isApplied && (
          <Ionicons name="checkmark-done" size={18} color={colors.success} />
        )}
      </View>
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
    marginLeft: 0, // Align with assistant bubble
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applyButton: {
    marginLeft: 8,
  },
});
