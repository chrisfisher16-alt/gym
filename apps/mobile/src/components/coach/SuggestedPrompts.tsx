import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from '../ui';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

interface PromptData {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: string;
  preview: string;
  variations: string[];
}

const PROMPTS: PromptData[] = [
  {
    text: 'Create a workout plan for me',
    icon: 'barbell-outline',
    category: 'Workout',
    preview: 'I\'ll design a personalized weekly program based on your goals, experience level, and available equipment.',
    variations: [
      'Build me a 4-day upper/lower split',
      'Create a beginner full-body routine',
      'Design a strength-focused program',
    ],
  },
  {
    text: "What should I eat today?",
    icon: 'restaurant-outline',
    category: 'Nutrition',
    preview: 'I\'ll suggest meals that fit your macro targets and dietary preferences for the rest of the day.',
    variations: [
      'Give me a high-protein lunch idea',
      'What\'s a good pre-workout meal?',
      'Plan my meals to hit my macros',
    ],
  },
  {
    text: "How's my progress this week?",
    icon: 'trending-up-outline',
    category: 'Progress',
    preview: 'I\'ll analyze your workout consistency, nutrition adherence, and key metrics from the past 7 days.',
    variations: [
      'Am I on track for my goals?',
      'Compare this week to last week',
      'What should I improve next week?',
    ],
  },
  {
    text: 'Help me hit my protein target',
    icon: 'nutrition-outline',
    category: 'Nutrition',
    preview: 'I\'ll calculate how much protein you still need today and suggest easy high-protein foods to close the gap.',
    variations: [
      'High-protein snack ideas',
      'How can I get 40g protein at lunch?',
      'Best protein sources for muscle gain',
    ],
  },
  {
    text: 'Suggest a recovery workout',
    icon: 'fitness-outline',
    category: 'Recovery',
    preview: 'I\'ll recommend a light session focused on mobility, stretching, and active recovery for your rest day.',
    variations: [
      'Give me a stretching routine',
      'What should I do on rest days?',
      'I\'m sore — what exercises are safe?',
    ],
  },
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
          <ExpandableCard
            key={prompt.text}
            style={{
              minWidth: 200,
              maxWidth: 280,
              marginBottom: spacing.xs,
            }}
            expandedContent={
              <PromptExpandedContent
                prompt={prompt}
                onSelect={onSelect}
              />
            }
          >
            {/* Collapsed: original chip layout */}
            <View style={styles.chip}>
              <Ionicons name={prompt.icon} size={16} color={colors.primary} />
              <Text
                style={[typography.bodySmall, { color: colors.text, marginLeft: spacing.xs, flex: 1 }]}
                numberOfLines={1}
              >
                {prompt.text}
              </Text>
              <Ionicons
                name="chevron-down-outline"
                size={14}
                color={colors.textTertiary}
                style={{ marginLeft: spacing.xs }}
              />
            </View>
          </ExpandableCard>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Expanded Content ──────────────────────────────────────────────

function PromptExpandedContent({
  prompt,
  onSelect,
}: {
  prompt: PromptData;
  onSelect: (text: string) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {/* Category tag */}
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
            {prompt.category}
          </Text>
        </View>
      </View>

      {/* Coach preview */}
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
        {prompt.preview}
      </Text>

      {/* Variations */}
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Related prompts
        </Text>
        {prompt.variations.map((variation) => (
          <TouchableOpacity
            key={variation}
            onPress={() => onSelect(variation)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing.xs,
            }}
          >
            <Ionicons name="arrow-forward-outline" size={12} color={colors.primary} />
            <Text
              style={[typography.bodySmall, { color: colors.text, marginLeft: spacing.xs }]}
              numberOfLines={1}
            >
              {variation}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Use this prompt button */}
      <TouchableOpacity
        onPress={() => onSelect(prompt.text)}
        activeOpacity={0.7}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          alignItems: 'center',
        }}
      >
        <Text style={[typography.label, { color: colors.textInverse }]}>
          Use this prompt
        </Text>
      </TouchableOpacity>
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
