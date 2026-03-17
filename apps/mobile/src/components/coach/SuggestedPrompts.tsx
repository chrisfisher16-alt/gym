import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  { text: 'Create a workout plan for me', icon: 'barbell-outline' as const },
  { text: "What should I eat today?", icon: 'restaurant-outline' as const },
  { text: "How's my progress this week?", icon: 'trending-up-outline' as const },
  { text: 'Help me hit my protein target', icon: 'nutrition-outline' as const },
  { text: 'Suggest a recovery workout', icon: 'fitness-outline' as const },
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md, paddingHorizontal: spacing.base }]}>
        Try asking...
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
      >
        {PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt.text}
            onPress={() => onSelect(prompt.text)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.borderLight,
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <Ionicons name={prompt.icon} size={16} color={colors.primary} />
            <Text
              style={[typography.bodySmall, { color: colors.text, marginLeft: spacing.xs }]}
              numberOfLines={1}
            >
              {prompt.text}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
