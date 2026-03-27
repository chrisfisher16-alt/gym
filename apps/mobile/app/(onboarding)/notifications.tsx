import React, { useRef, useState } from 'react';
import { Platform, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useTheme, typography as typographyStatic } from '../../src/theme';
import { selectionFeedback } from '../../src/lib/haptics';

// Lazily load expo-notifications to avoid crashes when the native module is unavailable
let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch (e) { console.warn('[Onboarding] notifications unavailable:', e); }
}

// ── Time Presets ────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: '6 AM', value: '06:00' },
  { label: '7 AM', value: '07:00' },
  { label: '8 AM', value: '08:00' },
  { label: '9 AM', value: '09:00' },
  { label: '10 AM', value: '10:00' },
  { label: '12 PM', value: '12:00' },
  { label: '5 PM', value: '17:00' },
  { label: '6 PM', value: '18:00' },
  { label: '7 PM', value: '19:00' },
] as const;

function formatTime(value: string): string {
  const preset = TIME_PRESETS.find((t) => t.value === value);
  return preset?.label ?? '9 AM';
}

export default function NotificationsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const setNotificationsEnabled = useOnboardingStore((s) => s.setNotificationsEnabled);
  const setNotificationTime = useOnboardingStore((s) => s.setNotificationTime);
  const notificationTime = useOnboardingStore((s) => s.notificationTime);
  const [selectedTime, setSelectedTime] = useState(notificationTime || '09:00');

  const handleTimeSelect = (value: string) => {
    selectionFeedback();
    setSelectedTime(value);
    setNotificationTime(value);
  };

  const isNavigating = useRef(false);

  const handleEnable = async () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    try {
      if (Notifications) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          setNotificationsEnabled(true);
          setNotificationTime(selectedTime);
        }
      }
    } catch {
      // Permission request failed — continue anyway
    }
    router.push('/(onboarding)/attribution');
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  const handleNotNow = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setNotificationsEnabled(false);
    router.push('/(onboarding)/attribution');
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  return (
    <OnboardingScreen
      step="notifications"
      title="Get workout reminders on training days"
      subtitle="We'll preview your workout so you can get mentally ready."
      showCta
      showSkip={false}
      ctaLabel="Enable Notifications"
      onCtaPress={handleEnable}
      secondaryLabel="Not Now"
      onSecondaryPress={handleNotNow}
    >
      {/* Mock Notification Card */}
      <View
        style={[
          styles.notificationCard,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.lg,
          },
        ]}
      >
        <View style={styles.notificationHeader}>
          {/* App icon */}
          <View
            style={[
              styles.appIcon,
              { backgroundColor: colors.primary, borderRadius: radius.sm },
            ]}
          >
            <Text style={[styles.appIconText, { color: colors.textInverse }]}>F</Text>
          </View>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, flex: 1, marginLeft: spacing.sm },
            ]}
          >
            FORMIQ
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>now</Text>
        </View>

        <Text
          style={[
            typography.label,
            { color: colors.text, marginTop: spacing.sm },
          ]}
        >
          TODAY'S WORKOUT IS READY
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          Push Day: Bench Press, Overhead Press, and 4 more.
        </Text>
      </View>

      {/* Time Picker Section */}
      <View style={{ marginTop: spacing['2xl'] }}>
        <View style={styles.timeRow}>
          <Text style={[typography.label, { color: colors.text }]}>Time</Text>
          <View
            style={[
              styles.timePill,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.full,
              },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.primary}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={[typography.label, { color: colors.primary }]}>
              {formatTime(selectedTime)}
            </Text>
          </View>
        </View>

        {/* Horizontal preset pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.presetRow,
            { gap: spacing.sm, paddingVertical: spacing.base },
          ]}
        >
          {TIME_PRESETS.map((preset) => {
            const isSelected = selectedTime === preset.value;
            return (
              <Pressable
                key={preset.value}
                onPress={() => handleTimeSelect(preset.value)}
                style={[
                  styles.presetPill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceSecondary,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    {
                      color: isSelected ? colors.textInverse : colors.textSecondary,
                    },
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Footnote */}
      <Text
        style={[
          typography.bodySmall,
          {
            color: colors.textTertiary,
            marginTop: spacing.sm,
          },
        ]}
      >
        You can change this anytime in Settings
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  notificationCard: {
    padding: 16,
    marginTop: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconText: {
    ...typographyStatic.bodySmall,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetRow: {
    flexDirection: 'row',
  },
  presetPill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
