// ── Health Settings Screen ────────────────────────────────────────────

import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Linking } from 'react-native';
import { crossPlatformAlert } from '../src/lib/cross-platform-alert';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, ScreenContainer, Button, Divider, Badge } from '../src/components/ui';
import { useHealthStore } from '../src/stores/health-store';
import { getHealthProviderName, isHealthPlatform } from '../src/lib/health';
import type { HealthDataType } from '../src/lib/health';

const SYNC_ITEMS: Array<{
  key: keyof typeof TOGGLE_MAP;
  type: HealthDataType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
}> = [
  { key: 'steps', type: 'steps', icon: 'footsteps-outline', label: 'Steps', description: 'Daily step count' },
  { key: 'activeEnergy', type: 'active_energy', icon: 'flame-outline', label: 'Active Energy', description: 'Calories burned' },
  { key: 'workouts', type: 'workout', icon: 'barbell-outline', label: 'Workouts', description: 'Import from other apps' },
  { key: 'bodyWeight', type: 'body_weight', icon: 'scale-outline', label: 'Body Weight', description: 'Weight measurements' },
  { key: 'sleep', type: 'sleep', icon: 'moon-outline', label: 'Sleep', description: 'Sleep duration' },
];

const TOGGLE_MAP = {
  steps: true,
  activeEnergy: true,
  workouts: true,
  bodyWeight: true,
  sleep: true,
} as const;

export default function HealthSettingsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const isConnected = useHealthStore((s) => s.isConnected);
  const syncEnabled = useHealthStore((s) => s.syncEnabled);
  const lastSyncAt = useHealthStore((s) => s.lastSyncAt);
  const isSyncing = useHealthStore((s) => s.isSyncing);
  const toggleSync = useHealthStore((s) => s.toggleSync);
  const syncNow = useHealthStore((s) => s.syncNow);
  const disconnect = useHealthStore((s) => s.disconnect);

  const providerName = getHealthProviderName();
  const canConnect = isHealthPlatform();

  const handleDisconnect = () => {
    crossPlatformAlert(
      'Disconnect Health Data',
      `Stop syncing data from ${providerName ?? 'Health'}? Your previously imported data will remain in the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnect,
        },
      ],
    );
  };

  const handleOpenHealthApp = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('x-apple-health://');
    } else if (Platform.OS === 'android') {
      Linking.openURL('market://details?id=com.google.android.apps.healthdata');
    }
  };

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (!canConnect) {
    return (
      <ScreenContainer edges={[]}>
        <View style={[styles.webMessage, { paddingTop: spacing['4xl'] }]}>
          <Ionicons name="phone-portrait-outline" size={48} color={colors.textTertiary} />
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>
            Health Integrations
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Health integrations are available on mobile devices. Open this app on your iPhone or Android device to connect.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={[]}>
      {/* Connection Status */}
      <Card style={{ marginTop: spacing.base, marginBottom: spacing.base }}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? colors.success : colors.textTertiary },
              ]}
            />
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.label, { color: colors.text }]}>
                {isConnected ? 'Connected' : 'Not Connected'}
              </Text>
              {isConnected && providerName && (
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {providerName}
                </Text>
              )}
            </View>
          </View>
          {isConnected ? (
            <Badge label="Active" variant="success" />
          ) : (
            <Button
              title="Connect"
              onPress={() => router.push('/health-connect')}
              size="sm"
              fullWidth={false}
            />
          )}
        </View>
      </Card>

      {/* Sync Toggles */}
      {isConnected && (
        <>
          <Text
            style={[
              typography.labelSmall,
              {
                color: colors.textTertiary,
                marginBottom: spacing.sm,
                marginLeft: spacing.xs,
                textTransform: 'uppercase',
                letterSpacing: 1,
              },
            ]}
          >
            Data Sync
          </Text>
          <Card style={{ marginBottom: spacing.base }}>
            {SYNC_ITEMS.map((item, index) => (
              <View key={item.key}>
                <View style={[styles.toggleRow, { paddingVertical: spacing.md }]}>
                  <View style={styles.toggleLeft}>
                    <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                    <View style={{ marginLeft: spacing.md, flex: 1 }}>
                      <Text style={[typography.body, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={syncEnabled[item.key]}
                    onValueChange={(v) => toggleSync(item.type, v)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
                {index < SYNC_ITEMS.length - 1 && <Divider />}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Sync Actions */}
      {isConnected && (
        <>
          <Text
            style={[
              typography.labelSmall,
              {
                color: colors.textTertiary,
                marginBottom: spacing.sm,
                marginLeft: spacing.xs,
                textTransform: 'uppercase',
                letterSpacing: 1,
              },
            ]}
          >
            Sync
          </Text>
          <Card style={{ marginBottom: spacing.base }}>
            <View style={[styles.infoRow, { paddingVertical: spacing.md }]}>
              <Text style={[typography.body, { color: colors.text }]}>Last Synced</Text>
              <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                {formatLastSync(lastSyncAt)}
              </Text>
            </View>
            <Divider />
            <TouchableOpacity
              onPress={syncNow}
              disabled={isSyncing}
              style={[styles.actionRow, { paddingVertical: spacing.md, opacity: isSyncing ? 0.5 : 1 }]}
            >
              <Ionicons name="sync-outline" size={20} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.md }]}>
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </Card>
        </>
      )}

      {/* Device Settings Link */}
      {isConnected && (
        <>
          <Text
            style={[
              typography.labelSmall,
              {
                color: colors.textTertiary,
                marginBottom: spacing.sm,
                marginLeft: spacing.xs,
                textTransform: 'uppercase',
                letterSpacing: 1,
              },
            ]}
          >
            More
          </Text>
          <Card style={{ marginBottom: spacing.base }}>
            <TouchableOpacity
              onPress={handleOpenHealthApp}
              style={[styles.actionRow, { paddingVertical: spacing.md }]}
            >
              <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
              <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
                Open {providerName}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity
              onPress={handleDisconnect}
              style={[styles.actionRow, { paddingVertical: spacing.md }]}
            >
              <Ionicons name="unlink-outline" size={20} color={colors.error} />
              <Text style={[typography.body, { color: colors.error, marginLeft: spacing.md }]}>
                Disconnect {providerName}
              </Text>
            </TouchableOpacity>
          </Card>
        </>
      )}

      {/* Privacy Note */}
      <View style={[styles.privacyNote, { paddingVertical: spacing.lg, paddingHorizontal: spacing.xs }]}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.textTertiary} />
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginLeft: spacing.sm, flex: 1 },
          ]}
        >
          Your health data stays on your device and is never shared with third parties.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  webMessage: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
