import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Button, ScreenContainer } from '../../src/components/ui';

export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <ScreenContainer scrollable={false}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.primaryMuted },
            ]}
          >
            <Ionicons name="heart-outline" size={64} color={colors.primary} />
          </View>
          <Text style={[typography.displayLarge, { color: colors.text, marginTop: spacing['2xl'], textAlign: 'center' }]}>
            Health Coach
          </Text>
          <Text
            style={[
              typography.bodyLarge,
              {
                color: colors.textSecondary,
                marginTop: spacing.md,
                textAlign: 'center',
                paddingHorizontal: spacing.xl,
              },
            ]}
          >
            Your AI-powered personal health coach for workouts, nutrition, and overall wellness.
          </Text>
        </View>

        <View style={[styles.features, { gap: spacing.lg }]}>
          {[
            { icon: 'barbell-outline' as const, label: 'Smart Workout Programming' },
            { icon: 'nutrition-outline' as const, label: 'AI-Powered Nutrition Tracking' },
            { icon: 'chatbubble-ellipses-outline' as const, label: 'Personal AI Coach' },
          ].map((item) => (
            <View key={item.label} style={styles.featureRow}>
              <Ionicons name={item.icon} size={24} color={colors.primary} />
              <Text style={[typography.bodyLarge, { color: colors.text, marginLeft: spacing.md }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.bottom, { paddingBottom: spacing['2xl'] }]}>
          <Button
            title="Get Started"
            onPress={() => router.push('/(onboarding)/profile')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
  },
  hero: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  features: {
    paddingHorizontal: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottom: {
    width: '100%',
  },
});
