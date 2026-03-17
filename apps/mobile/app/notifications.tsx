// ── Notification Preferences Screen ───────────────────────────────

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, ScreenContainer, Divider, Button } from '../src/components/ui';
import { useNotificationStore } from '../src/stores/notification-store';
import type { DayOfWeek, HydrationInterval } from '../src/types/notifications';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const DAY_VALUES: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

const HYDRATION_OPTIONS: { label: string; value: HydrationInterval }[] = [
  { label: 'Every hour', value: 1 },
  { label: 'Every 2 hours', value: 2 },
  { label: 'Every 3 hours', value: 3 },
];

const WEEKDAY_OPTIONS: { label: string; value: DayOfWeek }[] = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

export default function NotificationsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const prefs = useNotificationStore((s) => s.preferences);
  const updatePreference = useNotificationStore((s) => s.updatePreference);
  const updateMealReminder = useNotificationStore((s) => s.updateMealReminder);
  const setWorkoutDays = useNotificationStore((s) => s.setWorkoutDays);
  const setHydrationInterval = useNotificationStore((s) => s.setHydrationInterval);
  const requestPermission = useNotificationStore((s) => s.requestPermission);

  const [requesting, setRequesting] = useState(false);

  const handleRequestPermission = useCallback(async () => {
    setRequesting(true);
    const status = await requestPermission();
    setRequesting(false);

    if (status === 'denied') {
      Alert.alert(
        'Notifications Disabled',
        'To enable notifications, go to your device Settings and allow notifications for this app.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openSettings();
              }
            },
          },
        ],
      );
    }
  }, [requestPermission]);

  const toggleWorkoutDay = useCallback(
    (day: DayOfWeek) => {
      const current = prefs.workoutReminderDays;
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort();
      setWorkoutDays(next);
    },
    [prefs.workoutReminderDays, setWorkoutDays],
  );

  const isPermissionGranted = prefs.permissionStatus === 'granted';

  return (
    <ScreenContainer edges={[]}>
      {/* Permission Banner */}
      {!isPermissionGranted && (
        <Card
          style={{
            marginTop: spacing.base,
            marginBottom: spacing.base,
            backgroundColor: colors.warningLight,
            borderColor: colors.warning,
          }}
        >
          <View style={styles.permissionBanner}>
            <View style={styles.permissionTextContainer}>
              <Ionicons name="notifications-off-outline" size={24} color={colors.warning} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.label, { color: colors.text }]}>
                  Notifications are off
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Enable notifications to get workout reminders, meal tracking nudges, and helpful
                  tips.
                </Text>
              </View>
            </View>
            <Button
              title="Enable Notifications"
              onPress={handleRequestPermission}
              size="md"
              loading={requesting}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </Card>
      )}

      {/* Workout Reminders */}
      <SectionHeader title="Workout Reminders" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="barbell-outline"
          label="Workout Reminders"
          value={prefs.workoutRemindersEnabled}
          onToggle={(v) => updatePreference('workoutRemindersEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.workoutRemindersEnabled && (
          <>
            <Divider />
            <TimeRow
              label="Reminder Time"
              value={prefs.workoutReminderTime}
              onSelect={(t) => updatePreference('workoutReminderTime', t)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <Divider />
            <View style={{ paddingVertical: spacing.md }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Workout Days
              </Text>
              <View style={styles.dayRow}>
                {DAY_VALUES.map((day, idx) => {
                  const isSelected = prefs.workoutReminderDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleWorkoutDay(day)}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? colors.textInverse : colors.textSecondary },
                        ]}
                      >
                        {DAY_LABELS[idx]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </Card>

      {/* Meal Reminders */}
      <SectionHeader title="Meal Reminders" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="restaurant-outline"
          label="Meal Reminders"
          value={prefs.mealRemindersEnabled}
          onToggle={(v) => updatePreference('mealRemindersEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.mealRemindersEnabled && (
          <>
            <Divider />
            <MealToggleRow
              label="Breakfast"
              enabled={prefs.mealReminders.breakfast.enabled}
              time={prefs.mealReminders.breakfast.time}
              onToggle={(v) => updateMealReminder('breakfast', { enabled: v })}
              onTimeSelect={(t) => updateMealReminder('breakfast', { time: t })}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <Divider />
            <MealToggleRow
              label="Lunch"
              enabled={prefs.mealReminders.lunch.enabled}
              time={prefs.mealReminders.lunch.time}
              onToggle={(v) => updateMealReminder('lunch', { enabled: v })}
              onTimeSelect={(t) => updateMealReminder('lunch', { time: t })}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <Divider />
            <MealToggleRow
              label="Dinner"
              enabled={prefs.mealReminders.dinner.enabled}
              time={prefs.mealReminders.dinner.time}
              onToggle={(v) => updateMealReminder('dinner', { enabled: v })}
              onTimeSelect={(t) => updateMealReminder('dinner', { time: t })}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          </>
        )}
      </Card>

      {/* Hydration Reminders */}
      <SectionHeader title="Hydration Reminders" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="water-outline"
          label="Hydration Reminders"
          value={prefs.hydrationRemindersEnabled}
          onToggle={(v) => updatePreference('hydrationRemindersEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.hydrationRemindersEnabled && (
          <>
            <Divider />
            <View style={{ paddingVertical: spacing.md }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Reminder Frequency
              </Text>
              <View style={styles.optionRow}>
                {HYDRATION_OPTIONS.map((opt) => {
                  const isSelected = prefs.hydrationIntervalHours === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setHydrationInterval(opt.value)}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                          borderRadius: radius.md,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? colors.textInverse : colors.textSecondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </Card>

      {/* Supplement Reminders */}
      <SectionHeader title="Supplement Reminders" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="medical-outline"
          label="Supplement Reminders"
          value={prefs.supplementRemindersEnabled}
          onToggle={(v) => updatePreference('supplementRemindersEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.supplementRemindersEnabled && (
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            Uses your supplement schedule times
          </Text>
        )}
      </Card>

      {/* Weekly Check-in */}
      <SectionHeader title="Weekly Check-in" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="calendar-outline"
          label="Weekly Check-in"
          value={prefs.weeklyCheckinEnabled}
          onToggle={(v) => updatePreference('weeklyCheckinEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.weeklyCheckinEnabled && (
          <>
            <Divider />
            <View style={{ paddingVertical: spacing.md }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Day of Week
              </Text>
              <View style={styles.dayRow}>
                {WEEKDAY_OPTIONS.map((opt) => {
                  const isSelected = prefs.weeklyCheckinDay === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => updatePreference('weeklyCheckinDay', opt.value)}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? colors.textInverse : colors.textSecondary },
                        ]}
                      >
                        {DAY_LABELS[opt.value]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Divider />
            <TimeRow
              label="Check-in Time"
              value={prefs.weeklyCheckinTime}
              onSelect={(t) => updatePreference('weeklyCheckinTime', t)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
          </>
        )}
      </Card>

      {/* Coach Tips */}
      <SectionHeader title="Coach Tips" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing.base }}>
        <ToggleRow
          icon="bulb-outline"
          label="Daily Coach Tips"
          value={prefs.coachTipsEnabled}
          onToggle={(v) => updatePreference('coachTipsEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.coachTipsEnabled && (
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
            Receive a daily AI-generated health tip
          </Text>
        )}
      </Card>

      {/* Quiet Hours */}
      <SectionHeader title="Quiet Hours" colors={colors} typography={typography} spacing={spacing} />
      <Card style={{ marginBottom: spacing['3xl'] }}>
        <ToggleRow
          icon="moon-outline"
          label="Quiet Hours"
          value={prefs.quietHoursEnabled}
          onToggle={(v) => updatePreference('quietHoursEnabled', v)}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        {prefs.quietHoursEnabled && (
          <>
            <Divider />
            <TimeRow
              label="Start"
              value={prefs.quietHoursStart}
              onSelect={(t) => updatePreference('quietHoursStart', t)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <Divider />
            <TimeRow
              label="End"
              value={prefs.quietHoursEnd}
              onSelect={(t) => updatePreference('quietHoursEnd', t)}
              colors={colors}
              typography={typography}
              spacing={spacing}
            />
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                No notifications between {formatTime(prefs.quietHoursStart)} and{' '}
                {formatTime(prefs.quietHoursEnd)}
              </Text>
            </View>
          </>
        )}
      </Card>
    </ScreenContainer>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

function SectionHeader({
  title,
  colors,
  typography: typo,
  spacing: sp,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <Text
      style={[
        typo.labelSmall,
        {
          color: colors.textTertiary,
          marginBottom: sp.sm,
          marginLeft: sp.xs,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
      ]}
    >
      {title}
    </Text>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  colors,
  typography: typo,
  spacing: sp,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={[styles.toggleRow, { paddingVertical: sp.md }]}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <Text style={[typo.body, { color: colors.text, marginLeft: sp.md }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function MealToggleRow({
  label,
  enabled,
  time,
  onToggle,
  onTimeSelect,
  colors,
  typography: typo,
  spacing: sp,
}: {
  label: string;
  enabled: boolean;
  time: string;
  onToggle: (value: boolean) => void;
  onTimeSelect: (time: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={{ paddingVertical: sp.sm }}>
      <View style={[styles.toggleRow]}>
        <Text style={[typo.body, { color: colors.text, marginLeft: 32 }]}>{label}</Text>
        <View style={styles.mealRight}>
          {enabled && (
            <TimePickerButton
              value={time}
              onSelect={onTimeSelect}
              colors={colors}
              typography={typo}
              spacing={sp}
            />
          )}
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#FFFFFF"
            style={{ marginLeft: sp.sm }}
          />
        </View>
      </View>
    </View>
  );
}

function TimeRow({
  label,
  value,
  onSelect,
  colors,
  typography: typo,
  spacing: sp,
}: {
  label: string;
  value: string;
  onSelect: (time: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  return (
    <View style={[styles.toggleRow, { paddingVertical: sp.md }]}>
      <Text style={[typo.body, { color: colors.text }]}>{label}</Text>
      <TimePickerButton value={value} onSelect={onSelect} colors={colors} typography={typo} spacing={sp} />
    </View>
  );
}

function TimePickerButton({
  value,
  onSelect,
  colors,
  typography: typo,
  spacing: sp,
}: {
  value: string;
  onSelect: (time: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  const handlePress = () => {
    // Cycle through common times for simplicity (no native picker dependency)
    const times = [
      '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
      '21:00', '21:30', '22:00', '22:30', '23:00',
    ];
    const currentIdx = times.indexOf(value);
    const nextIdx = (currentIdx + 1) % times.length;
    onSelect(times[nextIdx]);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.timeButton,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: sp.sm,
          paddingHorizontal: sp.md,
          paddingVertical: sp.xs,
        },
      ]}
    >
      <Ionicons name="time-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
      <Text style={[typo.label, { color: colors.primary }]}>{formatTime(value)}</Text>
    </TouchableOpacity>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  permissionBanner: {
    alignItems: 'stretch',
  },
  permissionTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
