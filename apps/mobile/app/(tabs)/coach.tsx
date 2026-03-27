import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useCoachStore } from '../../src/stores/coach-store';
import { CoachAvatar } from '../../src/components/coach/CoachAvatar';
import { SmartHeader } from '../../src/components/ui';
import { CoachChatUI } from '../../src/components/CoachChatUI';
import { UsageCounterExpandable } from '../../src/components/coach/UsageCounter';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { CoachTabSkeleton } from '../../src/components/ui/SkeletonLayouts';
import { ScreenContainer } from '../../src/components/ui';
import { usePaywall } from '../../src/hooks/usePaywall';
import { checkAIMessageLimit, type UsageCheck } from '../../src/lib/usage-limits';

export default function CoachTab() {
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const messages = useCoachStore((s) => s.messages);
  const isInitialized = useCoachStore((s) => s.isInitialized);
  const startConversation = useCoachStore((s) => s.startConversation);

  const { tier } = useEntitlement();
  const { showPaywall } = usePaywall();
  const [aiUsage, setAIUsage] = useState<UsageCheck | null>(null);

  // Check AI message limits for free users
  useEffect(() => {
    if (tier === 'free') {
      checkAIMessageLimit().then(setAIUsage);
    }
  }, [tier, messages.length]);

  const handleNewConversation = async () => {
    await startConversation();
  };

  const headerBar = (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderLight,
          paddingTop: Platform.OS === 'ios' ? 52 : spacing.base,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.base,
        },
      ]}
    >
      <View style={styles.headerLeft}>
        <CoachAvatar size={36} />
        <View style={{ marginLeft: spacing.sm }}>
          <Text style={[typography.labelLarge, { color: colors.text }]}>AI Coach</Text>
          <SmartHeader tab="coach" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {tier === 'free' && aiUsage && (
          <UsageCounterExpandable
            aiUsage={aiUsage}
            onUpgrade={() => showPaywall({ feature: 'unlimited_ai', source: 'coach_tab' })}
          />
        )}
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNewConversation} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isInitialized) {
    return (
      <ScreenContainer>
        <CoachTabSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <CoachChatUI
      showHeader
      headerComponent={headerBar}
      keyboardVerticalOffset={90}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
