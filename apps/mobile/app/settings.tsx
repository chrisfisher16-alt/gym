import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, ScreenContainer, Badge, Divider } from '../src/components/ui';
import { useAuthStore } from '../src/stores/auth-store';
import { useNotificationStore } from '../src/stores/notification-store';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useEntitlement } from '../src/hooks/useEntitlement';
import { APP_CONFIG } from '@health-coach/shared';

export default function SettingsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const coachPreferences = useAuthStore((s) => s.coachPreferences);
  const signOut = useAuthStore((s) => s.signOut);
  const logoutSubscription = useSubscriptionStore((s) => s.logout);
  const notificationStatus = useNotificationStore((s) => s.preferences.permissionStatus);
  const { tier, tierName, isSubscribed, isTrial } = useEntitlement();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logoutSubscription();
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={[]}>
      {/* Profile Section */}
      <Card style={{ marginTop: spacing.base, marginBottom: spacing.base }}>
        <View style={styles.profileRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primaryMuted, borderRadius: radius.full },
            ]}
          >
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {profile?.display_name ?? 'User'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {user?.email ?? ''}
            </Text>
          </View>
          <Badge label={tierName} variant={isSubscribed ? 'pro' : 'default'} />
        </View>
      </Card>

      {/* Preferences */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Preferences
      </Text>
      <Card style={{ marginBottom: spacing.base }}>
        <SettingRow
          icon="scale-outline"
          label="Units"
          value={profile?.unit_preference === 'metric' ? 'Metric' : 'Imperial'}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        <Divider />
        <SettingRow
          icon="chatbubble-outline"
          label="Coach Tone"
          value={coachPreferences?.coach_tone
            ? coachPreferences.coach_tone.charAt(0).toUpperCase() + coachPreferences.coach_tone.slice(1)
            : 'Balanced'
          }
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        <Divider />
        <View style={[styles.settingRow, { paddingVertical: spacing.md }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>
              Dark Mode
            </Text>
          </View>
          <Switch
            value={false}
            onValueChange={() => {}}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      {/* Subscription */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Subscription
      </Text>
      <Card style={{ marginBottom: spacing.base }}>
        <SettingRow
          icon="diamond-outline"
          label="Plan"
          value={tierName + (isTrial ? ' (Trial)' : '')}
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => isSubscribed ? {} : router.push('/paywall')}
        />
        {!isSubscribed && (
          <>
            <Divider />
            <SettingRow
              icon="arrow-up-circle-outline"
              label="Upgrade"
              value="View plans"
              colors={colors}
              typography={typography}
              spacing={spacing}
              showChevron
              onPress={() => router.push('/paywall')}
            />
          </>
        )}
        {isSubscribed && (
          <>
            <Divider />
            <SettingRow
              icon="settings-outline"
              label="Manage Subscription"
              colors={colors}
              typography={typography}
              spacing={spacing}
              showChevron
              onPress={() => router.push('/paywall')}
            />
          </>
        )}
      </Card>

      {/* More */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        More
      </Text>
      <Card style={{ marginBottom: spacing.base }}>
        <SettingRow
          icon="notifications-outline"
          label="Notifications"
          value={notificationStatus === 'granted' ? 'Enabled' : 'Disabled'}
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => router.push('/notifications')}
        />
        <Divider />
        <SettingRow
          icon="heart-outline"
          label="Health Integrations"
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
        />
        <Divider />
        <SettingRow
          icon="help-circle-outline"
          label="Support"
          value={APP_CONFIG.supportEmail}
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
        <Divider />
        <SettingRow
          icon="information-circle-outline"
          label="About"
          value="v1.0.0"
          colors={colors}
          typography={typography}
          spacing={spacing}
        />
      </Card>

      {/* Sign Out */}
      <TouchableOpacity
        onPress={handleSignOut}
        activeOpacity={0.7}
        style={[
          styles.signOutBtn,
          {
            backgroundColor: colors.errorLight,
            borderRadius: radius.lg,
            padding: spacing.base,
            marginBottom: spacing['3xl'],
          },
        ]}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={[typography.labelLarge, { color: colors.error, marginLeft: spacing.sm }]}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

function SettingRow({
  icon,
  label,
  value,
  showChevron,
  colors,
  typography: typo,
  spacing: sp,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  showChevron?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress ?? (() => {})}
      style={[settingStyles.row, { paddingVertical: sp.md }]}
    >
      <View style={settingStyles.left}>
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <Text style={[typo.body, { color: colors.text, marginLeft: sp.md }]}>{label}</Text>
      </View>
      <View style={settingStyles.right}>
        {value && (
          <Text style={[typo.bodySmall, { color: colors.textTertiary, marginRight: sp.xs }]}>
            {value}
          </Text>
        )}
        {showChevron && (
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
