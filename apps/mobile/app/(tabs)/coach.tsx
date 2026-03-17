import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, ScreenContainer } from '../../src/components/ui';

const SUGGESTED_PROMPTS = [
  'Create a workout plan for me',
  'What should I eat today?',
  'How can I improve my bench press?',
  'Review my weekly progress',
  'Suggest a healthy snack',
  'Help me hit my protein goal',
];

export default function CoachTab() {
  const { colors, spacing, typography, radius } = useTheme();

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <Text style={[typography.h1, { color: colors.text }]}>Coach</Text>
      </View>

      {/* Chat Placeholder */}
      <View style={[styles.chatPlaceholder, { marginBottom: spacing.xl }]}>
        <View
          style={[
            styles.coachAvatar,
            { backgroundColor: colors.primaryMuted, borderRadius: radius.full },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={32} color={colors.primary} />
        </View>
        <Text
          style={[
            typography.h2,
            { color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
          ]}
        >
          Your AI Health Coach
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
          ]}
        >
          Ask anything about workouts, nutrition, or your health goals.
        </Text>
      </View>

      {/* Suggested Prompts */}
      <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
        Suggested Questions
      </Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing['2xl'] }}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <TouchableOpacity key={prompt} activeOpacity={0.7} onPress={() => {}}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              <Text
                style={[
                  typography.body,
                  { color: colors.text, marginLeft: spacing.md, flex: 1 },
                ]}
              >
                {prompt}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  coachAvatar: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
