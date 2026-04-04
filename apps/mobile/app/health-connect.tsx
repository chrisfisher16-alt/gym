// ── Health Connection Education Screen ────────────────────────────────
//
// Shown before requesting health permissions. Explains what data will
// be accessed, why, and provides privacy assurances.

import { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Button, ScreenContainer, Card } from '../src/components/ui';
import { useHealthStore } from '../src/stores/health-store';
import { isHealthPlatform, getHealthProviderName } from '../src/lib/health';

const DATA_EXPLANATIONS = [
  {
    icon: 'footsteps-outline' as const,
    title: 'Steps',
    description: 'Track your daily activity alongside workouts',
  },
  {
    icon: 'flame-outline' as const,
    title: 'Active Energy',
    description: 'See total calories burned including workouts',
  },
  {
    icon: 'barbell-outline' as const,
    title: 'Workouts',
    description: 'Import workouts from other fitness apps',
  },
  {
    icon: 'scale-outline' as const,
    title: 'Body Weight',
    description: 'Track weight changes over time',
  },
  {
    icon: 'moon-outline' as const,
    title: 'Sleep',
    description: 'Understand how recovery affects performance',
  },
];

export default function HealthConnectScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const requestPermissions = useHealthStore((s) => s.requestPermissions);
  const isLoading = useHealthStore((s) => s.isLoading);
  const [connecting, setConnecting] = useState(false);

  const providerName = getHealthProviderName() ?? 'Health';
  const isIOS = Platform.OS === 'ios';
  const canConnect = isHealthPlatform();

  const handleConnect = async () => {
    setConnecting(true);
    const granted = await requestPermissions();
    setConnecting(false);

    // Always navigate to tabs — this screen is reached via replace() from
    // onboarding so there is no previous screen to go back to.
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer scrollable={true}>
      <View style={[styles.content, { paddingTop: spacing['2xl'] }]}>
        {/* Header Icon */}
        <View style={styles.center}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isIOS ? colors.errorLight : colors.successLight,
                borderRadius: radius.full,
              },
            ]}
          >
            <Ionicons
              name={isIOS ? 'heart' : 'fitness'}
              size={48}
              color={isIOS ? colors.error : colors.success}
            />
          </View>

          <Text
            style={[
              typography.displayMedium,
              { color: colors.text, marginTop: spacing.xl, textAlign: 'center' },
            ]}
          >
            Connect Your Health Data
          </Text>

          <Text
            style={[
              typography.bodyLarge,
              {
                color: colors.textSecondary,
                marginTop: spacing.sm,
                textAlign: 'center',
                maxWidth: 300,
              },
            ]}
          >
            {canConnect
              ? `Sync data from ${providerName} to get a complete picture of your health.`
              : 'Health integrations are available on mobile devices.'}
          </Text>
        </View>

        {/* Data Explanations */}
        {canConnect && (
          <Card style={{ marginTop: spacing.xl }}>
            {DATA_EXPLANATIONS.map((item, index) => (
              <View key={item.title}>
                <View style={[styles.dataRow, { paddingVertical: spacing.md }]}>
                  <View
                    style={[
                      styles.dataIcon,
                      {
                        backgroundColor: colors.primaryMuted,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.dataText}>
                    <Text style={[typography.label, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: 2 },
                      ]}
                    >
                      {item.description}
                    </Text>
                  </View>
                </View>
                {index < DATA_EXPLANATIONS.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Privacy Assurance */}
        {canConnect && (
          <View
            style={[
              styles.privacyRow,
              { marginTop: spacing.lg, paddingVertical: spacing.md },
            ]}
          >
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 },
              ]}
            >
              Your health data stays on your device and is never shared.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.actions, { marginTop: spacing.xl, gap: spacing.md, paddingBottom: spacing['2xl'] }]}>
          {canConnect ? (
            <>
              <Button
                title={`Connect ${providerName}`}
                onPress={handleConnect}
                loading={connecting || isLoading}
                icon={
                  <Ionicons
                    name={isIOS ? 'heart' : 'fitness'}
                    size={20}
                    color={colors.textInverse}
                    style={{ marginRight: spacing.xs }}
                  />
                }
              />
              <Button
                title="Not Now"
                onPress={handleSkip}
                variant="ghost"
              />
            </>
          ) : (
            <Button
              title="Go Back"
              onPress={handleSkip}
              variant="secondary"
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataText: {
    flex: 1,
    marginLeft: 12,
  },
  separator: {
    height: 1,
    marginLeft: 52,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    width: '100%',
  },
});
