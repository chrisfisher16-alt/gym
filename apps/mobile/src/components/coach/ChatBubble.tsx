import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { CoachAvatar } from './CoachAvatar';
import { WorkoutPlanCard } from './WorkoutPlanCard';
import { NutritionCard } from './NutritionCard';
import { MealAnalysisCard } from './MealAnalysisCard';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import type { CoachMessage } from '../../stores/coach-store';

interface ChatBubbleProps {
  message: CoachMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.avatarWrapper}>
          <CoachAvatar size={32} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: isUser ? 0 : 1,
            borderColor: colors.borderLight,
            maxWidth: '80%',
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
    </View>
  );
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

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
});
