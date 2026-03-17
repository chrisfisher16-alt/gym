import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer, Card } from '../src/components/ui';

export default function PrivacyPolicyScreen() {
  const { colors, spacing, typography, radius } = useTheme();

  const sections = [
    {
      title: '1. Data Collection',
      content:
        'We collect information you provide directly, including your name, email address, fitness goals, body measurements, and workout/nutrition logs. We also collect usage data to improve our services, such as app interaction patterns and feature usage frequency.\n\nInformation is collected when you create an account, use our coaching features, log workouts or meals, or interact with the AI coach.',
    },
    {
      title: '2. Health Data',
      content:
        'With your explicit permission, we access health data from Apple Health (iOS) or Health Connect (Android), including steps, active energy, sleep data, and body weight.\n\nHealth data is used solely to provide personalized coaching recommendations and track your progress. We never sell health data to third parties. You can revoke health data access at any time through the app settings or your device settings.',
    },
    {
      title: '3. AI Usage',
      content:
        'Our AI coaching features process your fitness and nutrition data to provide personalized recommendations. Conversations with the AI coach are stored to maintain context and improve coaching quality.\n\nAI-generated advice is for informational purposes only and should not replace professional medical advice. We may use anonymized, aggregated data to improve our AI models.',
    },
    {
      title: '4. Third Parties',
      content:
        'We use the following third-party services:\n\n• Supabase — Database and authentication\n• RevenueCat — Subscription management\n• OpenAI / Anthropic — AI coaching features\n• Apple Health / Health Connect — Health data integration\n\nEach third-party service has its own privacy policy. We only share the minimum data necessary for each service to function.',
    },
    {
      title: '5. Data Retention',
      content:
        'Your account data is retained for as long as your account is active. Workout and nutrition logs are retained indefinitely to support your progress tracking.\n\nIf you delete your account, we will remove your personal data within 30 days. Some anonymized, aggregated data may be retained for analytics purposes.\n\nAI conversation history is retained for 12 months to maintain coaching context.',
    },
    {
      title: '6. Your Rights',
      content:
        'You have the right to:\n\n• Access your personal data\n• Export your data in a portable format\n• Request correction of inaccurate data\n• Request deletion of your account and data\n• Opt out of non-essential data collection\n• Revoke health data permissions at any time\n\nTo exercise any of these rights, contact us at support@healthcoach.app.',
    },
  ];

  return (
    <ScreenContainer edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing.base, paddingBottom: spacing['3xl'] }}>
          <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.sm }]}>
            Privacy Policy
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.lg }]}>
            Last updated: March 2026
          </Text>

          <Card
            style={{
              marginBottom: spacing.base,
              backgroundColor: colors.warningLight,
              borderColor: colors.warning,
              borderWidth: 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <Text
                style={[
                  typography.label,
                  { color: colors.text, marginLeft: spacing.sm, flex: 1 },
                ]}
              >
                Placeholder — Replace with actual legal text reviewed by a lawyer before launch.
              </Text>
            </View>
          </Card>

          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 },
            ]}
          >
            Health Coach (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to
            protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our mobile application.
          </Text>

          {sections.map((section) => (
            <View key={section.title} style={{ marginBottom: spacing.xl }}>
              <Text
                style={[
                  typography.h3,
                  { color: colors.text, marginBottom: spacing.sm },
                ]}
              >
                {section.title}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, lineHeight: 22 },
                ]}
              >
                {section.content}
              </Text>
            </View>
          ))}

          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
              If you have questions about this Privacy Policy, contact us at{'\n'}
              support@healthcoach.app
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
