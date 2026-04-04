import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../src/theme';
import { ScreenContainer } from '../src/components/ui';

export default function TermsOfServiceScreen() {
  const { colors, spacing, typography } = useTheme();

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content:
        'By downloading, installing, or using the Health Coach application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.\n\nWe reserve the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the modified Terms.',
    },
    {
      title: '2. Service Description',
      content:
        'Health Coach is an AI-powered health and fitness coaching application that provides:\n\n• Workout tracking and programming\n• Nutrition logging and macro tracking\n• AI-powered coaching and recommendations\n• Health data integration\n• Progress analytics\n\nThe App is designed to assist with general fitness and nutrition goals and is not a medical device or healthcare service.',
    },
    {
      title: '3. Subscriptions & Billing',
      content:
        'Health Coach offers free and premium subscription tiers. Premium subscriptions are billed through Apple App Store or Google Play Store.\n\n• Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period\n• Payment is charged to your App Store / Play Store account at confirmation of purchase\n• You can manage and cancel subscriptions through your device settings\n• No refunds for partial billing periods, except as required by applicable law\n• Free trial periods, if offered, convert to paid subscriptions automatically',
    },
    {
      title: '4. Health Disclaimer',
      content:
        'IMPORTANT: This app is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.\n\n• The AI coach provides general fitness and nutrition guidance only\n• Do not disregard professional medical advice based on information from this App\n• If you think you may have a medical emergency, call your doctor or emergency services immediately\n• Consult a healthcare professional before starting any new exercise or nutrition program\n• The App is not intended for users under 16 years of age',
    },
    {
      title: '5. AI Disclaimer',
      content:
        'The AI coaching features are powered by artificial intelligence and machine learning:\n\n• AI recommendations are generated algorithmically and may not always be accurate\n• AI responses should be considered suggestions, not professional advice\n• The AI does not have access to your complete medical history\n• AI-generated workout and nutrition plans should be reviewed for safety before following\n• We continuously improve our AI, but cannot guarantee perfect accuracy\n• You are responsible for evaluating the appropriateness of AI suggestions for your situation',
    },
    {
      title: '6. Age Requirements',
      content:
        'You must be at least 13 years old to create an account and use Health Coach. If you are between 13 and 17 years old, you must have the consent of a parent or guardian to use the App.\n\nBy creating an account, you represent that you meet these age requirements. We reserve the right to terminate accounts that we reasonably believe are held by users under the age of 13.',
    },
    {
      title: '7. User Responsibilities',
      content:
        'As a user, you agree to:\n\n• Provide accurate information when creating your account and logging data\n• Use the App in compliance with all applicable laws\n• Not misuse or attempt to reverse-engineer the App\n• Not share your account credentials\n• Not use the App for any purpose other than personal health and fitness tracking\n• Report any security vulnerabilities responsibly',
    },
    {
      title: '8. Intellectual Property',
      content:
        'All content, features, and functionality of the App are owned by Health Coach and are protected by international copyright, trademark, and other intellectual property laws.\n\nYou retain ownership of any personal data and content you submit to the App.',
    },
    {
      title: '9. Limitation of Liability',
      content:
        'To the fullest extent permitted by law, Health Coach shall not be liable for:\n\n• Any indirect, incidental, special, consequential, or punitive damages\n• Any loss of profits, data, or goodwill\n• Personal injury or health issues arising from following AI-generated recommendations\n• Service interruptions, errors, or data loss\n• Any damages exceeding the amount paid by you in the 12 months preceding the claim\n\nSome jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above may not apply to you.',
    },
    {
      title: '10. Termination',
      content:
        'We may terminate or suspend your account at any time for violation of these Terms. You may delete your account at any time through the App settings.\n\nUpon termination, your right to use the App ceases immediately. Provisions that by their nature should survive termination shall survive.',
    },
    {
      title: '11. Governing Law',
      content:
        'These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.\n\nAny disputes arising from these Terms or your use of the App shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, except where prohibited by law. You agree that any arbitration will be conducted on an individual basis and not as a class, consolidated, or representative action.',
    },
  ];

  return (
    <ScreenContainer edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing.base, paddingBottom: spacing['3xl'] }}>
          <Text style={[typography.h1, { color: colors.text, marginBottom: spacing.sm }]}>
            Terms of Service
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginBottom: spacing.lg }]}>
            Last updated: March 2026
          </Text>

          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 },
            ]}
          >
            Please read these Terms of Service carefully before using the Health Coach application.
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
              If you have questions about these Terms, contact us at{'\n'}
              support@healthcoach.app
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
