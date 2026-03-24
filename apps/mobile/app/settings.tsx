import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { crossPlatformAlert } from '../src/lib/cross-platform-alert';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { Card, ScreenContainer, Badge, Divider, ExpandableCard, SyncStatusBadge } from '../src/components/ui';
import { useAuthStore } from '../src/stores/auth-store';
import { useProfileStore } from '../src/stores/profile-store';
import { useNotificationStore } from '../src/stores/notification-store';
import { useSubscriptionStore } from '../src/stores/subscription-store';
import { useEntitlement } from '../src/hooks/useEntitlement';
import { APP_CONFIG } from '@health-coach/shared';
import { useThemeStore, type ColorMode } from '../src/stores/theme-store';
import { useSpaceStore, type TrainingSpace } from '../src/stores/space-store';
import { SpaceSwitcher, SpaceEditor } from '../src/components/ui';
import { checkAIMessageLimit, checkWorkoutLogLimit, checkMealLogLimit, type UsageCheck } from '../src/lib/usage-limits';
import type { CoachTone } from '@health-coach/shared';

export default function SettingsScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const coachPreferences = useAuthStore((s) => s.coachPreferences);
  const signOut = useAuthStore((s) => s.signOut);
  const logoutSubscription = useSubscriptionStore((s) => s.logout);
  const notificationStatus = useNotificationStore((s) => s.preferences.permissionStatus);
  const { tier, tierName, isSubscribed, isTrial } = useEntitlement();
  const profileData = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const setCoachPreferences = useAuthStore((s) => s.setCoachPreferences);
  const colorMode = useThemeStore((s) => s.colorMode);
  const setColorMode = useThemeStore((s) => s.setColorMode);

  // ── Space Editor state ──────────────────────────────────────────
  const [spaceEditorVisible, setSpaceEditorVisible] = useState(false);
  const [editingSpace, setEditingSpace] = useState<TrainingSpace | undefined>(undefined);

  useEffect(() => {
    useThemeStore.getState().initialize();
    useSpaceStore.getState().initialize();
  }, []);

  const handleSignOut = () => {
    crossPlatformAlert('Sign Out', 'Are you sure you want to sign out?', [
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

  // ── Computed profile values ────────────────────────────────────────

  const heightDisplay = profileData.heightCm
    ? profileData.unitPreference === 'imperial'
      ? `${Math.floor(profileData.heightCm / 2.54 / 12)}' ${Math.round(profileData.heightCm / 2.54 % 12)}"`
      : `${profileData.heightCm} cm`
    : null;

  const weightDisplay = profileData.weightKg
    ? profileData.unitPreference === 'imperial'
      ? `${Math.round(profileData.weightKg * 2.205)} lbs`
      : `${profileData.weightKg} kg`
    : null;

  const statsLine = [heightDisplay, weightDisplay].filter(Boolean).join(' · ');

  // BMI calculation
  const bmi =
    profileData.heightCm && profileData.weightKg
      ? (profileData.weightKg / (profileData.heightCm / 100) ** 2).toFixed(1)
      : null;

  // BMR (Mifflin-St Jeor approximation — requires gender assumption, use average)
  const bmr =
    profileData.heightCm && profileData.weightKg
      ? Math.round(10 * profileData.weightKg + 6.25 * profileData.heightCm - 5 * 30 + 5) // age assumed ~30
      : null;

  return (
    <ScreenContainer edges={[]}>
      {/* ── Profile Section (Expandable) ──────────────────────────── */}
      <ExpandableCard
        style={{ marginTop: spacing.base, marginBottom: spacing.base }}
        expandedContent={
          <ProfileExpandedContent
            profileData={profileData}
            heightDisplay={heightDisplay}
            weightDisplay={weightDisplay}
            bmi={bmi}
            bmr={bmr}
            email={user?.email ?? ''}
          />
        }
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
          style={styles.profileRow}
        >
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
            {statsLine ? (
              <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
                {statsLine}
              </Text>
            ) : null}
          </View>
          <Badge label={tierName} variant={isSubscribed ? 'pro' : 'default'} />
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textTertiary}
            style={{ marginLeft: spacing.sm }}
          />
        </TouchableOpacity>
      </ExpandableCard>

      {/* ── Training Spaces ───────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Training Spaces
      </Text>
      <Card style={{ marginBottom: spacing.base, padding: spacing.md }}>
        <SpaceSwitcher
          onCreatePress={() => {
            setEditingSpace(undefined);
            setSpaceEditorVisible(true);
          }}
          onEditPress={(space) => {
            setEditingSpace(space);
            setSpaceEditorVisible(true);
          }}
        />
      </Card>

      {/* ── Preferences ───────────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Preferences
      </Text>
      <Card style={{ marginBottom: spacing.base }}>
        <SettingRow
          icon="scale-outline"
          label="Units"
          value={(profileData.unitPreference ?? 'imperial') === 'metric' ? 'Metric' : 'Imperial'}
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => {
            const current = profileData.unitPreference ?? 'imperial';
            updateProfile({ unitPreference: current === 'imperial' ? 'metric' : 'imperial' });
          }}
        />
        <Divider />

        {/* Coach Tone — Expandable */}
        <CoachToneExpandable
          coachPreferences={coachPreferences}
          setCoachPreferences={setCoachPreferences}
        />

        <Divider />
        <View style={[styles.settingRow, { paddingVertical: spacing.md }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>
              Appearance
            </Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: 'hidden' }}>
            {(['light', 'dark', 'auto'] as ColorMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setColorMode(mode)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  backgroundColor: colorMode === mode ? colors.primary : 'transparent',
                  borderRadius: radius.md,
                }}
              >
                <Text style={[
                  typography.label,
                  {
                    color: colorMode === mode ? colors.textInverse : colors.textSecondary,
                    textTransform: 'capitalize',
                  },
                ]}>
                  {mode}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      {/* ── Subscription (Expandable) ─────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        Subscription
      </Text>
      <SubscriptionExpandable
        tier={tier}
        tierName={tierName}
        isSubscribed={isSubscribed}
        isTrial={isTrial}
      />

      {/* ── More ──────────────────────────────────────────────────── */}
      <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 }]}>
        More
      </Text>
      <Card style={{ marginBottom: spacing.base }}>
        <View style={[styles.settingRow, { paddingVertical: spacing.md }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="cloud-outline" size={20} color={colors.textSecondary} />
            <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>
              Sync
            </Text>
          </View>
          <SyncStatusBadge />
        </View>
        <Divider />
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
          onPress={() => router.push('/health-settings')}
        />
        <Divider />
        <SettingRow
          icon="hardware-chip-outline"
          label="AI Settings"
          value="Configure coach AI"
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => router.push('/ai-settings')}
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
        <Divider />
        <SettingRow
          icon="document-text-outline"
          label="Privacy Policy"
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => router.push('/privacy')}
        />
        <Divider />
        <SettingRow
          icon="reader-outline"
          label="Terms of Service"
          colors={colors}
          typography={typography}
          spacing={spacing}
          showChevron
          onPress={() => router.push('/terms')}
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
      {/* ── Space Editor Sheet ─────────────────────────────────── */}
      <SpaceEditor
        visible={spaceEditorVisible}
        onClose={() => {
          setSpaceEditorVisible(false);
          setEditingSpace(undefined);
        }}
        editingSpace={editingSpace}
      />
    </ScreenContainer>
  );
}

// ── Profile Expanded Content ─────────────────────────────────────────

function ProfileExpandedContent({
  profileData,
  heightDisplay,
  weightDisplay,
  bmi,
  bmr,
  email,
}: {
  profileData: ReturnType<typeof useProfileStore.getState>['profile'];
  heightDisplay: string | null;
  weightDisplay: string | null;
  bmi: string | null;
  bmr: number | null;
  email: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      {/* Physical stats */}
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          Body Stats
        </Text>
        {heightDisplay && <ProfileDetailRow label="Height" value={heightDisplay} />}
        {weightDisplay && <ProfileDetailRow label="Weight" value={weightDisplay} />}
        {bmi && <ProfileDetailRow label="BMI" value={bmi} />}
        {bmr && <ProfileDetailRow label="Est. BMR" value={`${bmr} cal/day`} />}
      </View>

      {/* Goals & preferences */}
      {(profileData.primaryGoal || profileData.activityLevel || profileData.trainingExperience) && (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            Goals & Activity
          </Text>
          {profileData.primaryGoal && (
            <ProfileDetailRow label="Primary Goal" value={profileData.primaryGoal.replace(/_/g, ' ')} />
          )}
          {profileData.activityLevel != null && (
            <ProfileDetailRow label="Activity Level" value={`Level ${profileData.activityLevel}`} />
          )}
          {profileData.trainingExperience && (
            <ProfileDetailRow label="Experience" value={profileData.trainingExperience} />
          )}
          {profileData.trainingDaysPerWeek != null && (
            <ProfileDetailRow label="Training Days/Week" value={`${profileData.trainingDaysPerWeek}`} />
          )}
        </View>
      )}

      {/* Edit profile CTA */}
      <TouchableOpacity
        onPress={() => router.push('/profile')}
        activeOpacity={0.7}
        style={{
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          alignItems: 'center',
        }}
      >
        <Text style={[typography.label, { color: colors.primary }]}>
          Edit Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileDetailRow({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600', textTransform: 'capitalize' }]}>{value}</Text>
    </View>
  );
}

// ── Coach Tone Expandable ────────────────────────────────────────────

const TONE_DATA: Record<CoachTone, { description: string; example: string }> = {
  direct: {
    description: 'Straight to the point. No fluff, no hand-holding.',
    example: '"You skipped legs again. Add squats today or your program stalls."',
  },
  balanced: {
    description: 'Friendly but focused. Encouragement with accountability.',
    example: '"Good effort this week! Let\'s tighten up your protein — you\'re about 30g short today."',
  },
  encouraging: {
    description: 'Maximum hype. Celebrates every win, gently nudges on misses.',
    example: '"You crushed that workout! 💪 For dinner, let\'s aim for something protein-rich to fuel recovery."',
  },
};

function CoachToneExpandable({
  coachPreferences,
  setCoachPreferences,
}: {
  coachPreferences: ReturnType<typeof useAuthStore.getState>['coachPreferences'];
  setCoachPreferences: ReturnType<typeof useAuthStore.getState>['setCoachPreferences'];
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const currentTone: CoachTone = coachPreferences?.tone ?? coachPreferences?.coach_tone ?? 'balanced';
  const tones: CoachTone[] = ['direct', 'balanced', 'encouraging'];

  const selectTone = (tone: CoachTone) => {
    if (coachPreferences) {
      setCoachPreferences({ ...coachPreferences, tone, coach_tone: tone });
    }
  };

  return (
    <ExpandableCard
      style={{ borderWidth: 0, shadowOpacity: 0, elevation: 0 }}
      expandedContent={
        <View style={{ gap: spacing.md }}>
          {tones.map((tone) => {
            const data = TONE_DATA[tone];
            const isActive = tone === currentTone;
            return (
              <TouchableOpacity
                key={tone}
                onPress={() => selectTone(tone)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: isActive ? colors.primaryMuted : colors.surfaceSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: isActive ? 1 : 0,
                  borderColor: isActive ? colors.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={[typography.label, { color: isActive ? colors.primary : colors.text, textTransform: 'capitalize' }]}>
                    {tone}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  )}
                </View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                  {data.description}
                </Text>
                <Text style={[typography.caption, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                  {data.example}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      }
    >
      {/* Collapsed: same as original SettingRow layout */}
      <View style={[settingStyles.row, { paddingVertical: 0 }]}>
        <View style={settingStyles.left}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>Coach Tone</Text>
        </View>
        <View style={settingStyles.right}>
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginRight: spacing.xs }]}>
            {currentTone.charAt(0).toUpperCase() + currentTone.slice(1)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </View>
    </ExpandableCard>
  );
}

// ── Subscription Expandable ──────────────────────────────────────────

function SubscriptionExpandable({
  tier,
  tierName,
  isSubscribed,
  isTrial,
}: {
  tier: string;
  tierName: string;
  isSubscribed: boolean;
  isTrial: boolean;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [aiUsage, setAIUsage] = useState<UsageCheck | null>(null);
  const [workoutUsage, setWorkoutUsage] = useState<UsageCheck | null>(null);
  const [mealUsage, setMealUsage] = useState<UsageCheck | null>(null);

  useEffect(() => {
    if (tier === 'free') {
      Promise.all([
        checkAIMessageLimit(),
        checkWorkoutLogLimit(),
        checkMealLogLimit(),
      ]).then(([ai, wk, ml]) => {
        setAIUsage(ai);
        setWorkoutUsage(wk);
        setMealUsage(ml);
      });
    }
  }, [tier]);

  return (
    <ExpandableCard
      style={{ marginBottom: spacing.base }}
      expandedContent={
        <View style={{ gap: spacing.md }}>
          {/* Feature comparison */}
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
              Feature Comparison
            </Text>
            <FeatureCompareRow label="AI Coach Messages" free="5/day" pro="Unlimited" isSubscribed={isSubscribed} />
            <FeatureCompareRow label="Workout Logs" free="10/month" pro="Unlimited" isSubscribed={isSubscribed} />
            <FeatureCompareRow label="Meal Logs" free="3/day" pro="Unlimited" isSubscribed={isSubscribed} />
            <FeatureCompareRow label="Meal Photo AI" free="—" pro="Included" isSubscribed={isSubscribed} />
            <FeatureCompareRow label="Advanced Analytics" free="—" pro="Included" isSubscribed={isSubscribed} />
          </View>

          {/* Usage breakdown for free users */}
          {tier === 'free' && (aiUsage || workoutUsage || mealUsage) && (
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.caption, { color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                Current Usage
              </Text>
              {aiUsage && (
                <SubUsageRow label="AI Messages" used={aiUsage.used} limit={aiUsage.limit} />
              )}
              {workoutUsage && (
                <SubUsageRow label="Workout Logs" used={workoutUsage.used} limit={workoutUsage.limit} />
              )}
              {mealUsage && (
                <SubUsageRow label="Meal Logs" used={mealUsage.used} limit={mealUsage.limit} />
              )}
            </View>
          )}

          {/* CTA */}
          {!isSubscribed && (
            <TouchableOpacity
              onPress={() => router.push('/paywall')}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.label, { color: colors.textInverse }]}>
                Upgrade to Pro
              </Text>
            </TouchableOpacity>
          )}
          {isSubscribed && (
            <TouchableOpacity
              onPress={() => router.push('/paywall')}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.label, { color: colors.textSecondary }]}>
                Manage Subscription
              </Text>
            </TouchableOpacity>
          )}
        </View>
      }
    >
      {/* Collapsed: plan name */}
      <View style={[settingStyles.row, { paddingVertical: 0 }]}>
        <View style={settingStyles.left}>
          <Ionicons name="diamond-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.body, { color: colors.text, marginLeft: spacing.md }]}>Plan</Text>
        </View>
        <View style={settingStyles.right}>
          <Text style={[typography.bodySmall, { color: colors.textTertiary, marginRight: spacing.xs }]}>
            {tierName}{isTrial ? ' (Trial)' : ''}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </View>
      </View>
    </ExpandableCard>
  );
}

function FeatureCompareRow({
  label,
  free,
  pro,
  isSubscribed,
}: {
  label: string;
  free: string;
  pro: string;
  isSubscribed: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>{label}</Text>
      <Text
        style={[
          typography.caption,
          {
            color: !isSubscribed ? colors.textTertiary : colors.textSecondary,
            width: 70,
            textAlign: 'center',
          },
        ]}
      >
        {free}
      </Text>
      <Text
        style={[
          typography.caption,
          {
            color: isSubscribed ? colors.primary : colors.textSecondary,
            fontWeight: isSubscribed ? '600' : '400',
            width: 70,
            textAlign: 'center',
          },
        ]}
      >
        {pro}
      </Text>
    </View>
  );
}

function SubUsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const { colors, spacing, radius, typography } = useTheme();
  const ratio = limit > 0 ? used / limit : 0;
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{used}/{limit}</Text>
      </View>
      <View style={{ height: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.full, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: ratio >= 0.8 ? colors.warning : colors.primary,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  );
}

// ── SettingRow (unchanged) ───────────────────────────────────────────

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
