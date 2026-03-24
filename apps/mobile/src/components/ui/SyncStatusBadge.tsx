import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
// Lazy-load NetInfo to prevent startup crashes when the native module isn't linked
let _NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
async function getNetInfo() {
  if (!_NetInfo) {
    const mod = await import('@react-native-community/netinfo');
    _NetInfo = mod.default;
  }
  return _NetInfo;
}
import { getSyncStatus, type SyncStatus } from '../../lib/supabase-sync';
import { useTheme } from '../../theme';

type SyncDisplayState =
  | { kind: 'synced' }
  | { kind: 'syncing' }
  | { kind: 'pending'; count: number }
  | { kind: 'offline' }
  | { kind: 'failed'; count: number };

const POLL_INTERVAL_MS = 5_000;

export function SyncStatusBadge() {
  const { colors, spacing, radius, typography } = useTheme();
  const [displayState, setDisplayState] = useState<SyncDisplayState>({ kind: 'synced' });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Poll sync status
  useEffect(() => {
    let mounted = true;

    async function refresh() {
      if (!mounted) return;

      let isConnected = true; // Assume online if NetInfo unavailable
      try {
        const NetInfo = await getNetInfo();
        const netInfo = await NetInfo.fetch();
        isConnected = !!netInfo.isConnected;
      } catch {
        // Assume online if NetInfo unavailable
      }
      if (!isConnected) {
        setDisplayState({ kind: 'offline' });
        return;
      }

      const status: SyncStatus = await getSyncStatus();

      if (status.isSyncing) {
        setDisplayState({ kind: 'syncing' });
      } else if (status.lastError && status.pendingCount === 0) {
        // Items failed permanently — show count from error message
        const match = status.lastError.match(/(\d+)/);
        const failedCount = match ? parseInt(match[1], 10) : 1;
        setDisplayState({ kind: 'failed', count: failedCount });
      } else if (status.pendingCount > 0) {
        setDisplayState({ kind: 'pending', count: status.pendingCount });
      } else {
        setDisplayState({ kind: 'synced' });
      }
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Pulse animation for syncing state
  useEffect(() => {
    if (displayState.kind === 'syncing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [displayState.kind, pulseAnim]);

  const config = getDisplayConfig(displayState, colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: config.dotColor,
            opacity: displayState.kind === 'syncing' ? pulseAnim : 1,
          },
        ]}
      />
      <Text
        style={[
          typography.labelSmall,
          { color: config.textColor, marginLeft: 4 },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

interface DisplayConfig {
  bg: string;
  dotColor: string;
  textColor: string;
  label: string;
}

function getDisplayConfig(
  state: SyncDisplayState,
  colors: ReturnType<typeof useTheme>['colors'],
): DisplayConfig {
  switch (state.kind) {
    case 'synced':
      return {
        bg: colors.successLight,
        dotColor: colors.success,
        textColor: colors.success,
        label: 'Synced',
      };
    case 'syncing':
      return {
        bg: colors.warningLight,
        dotColor: colors.warning,
        textColor: colors.warning,
        label: 'Syncing…',
      };
    case 'pending':
      return {
        bg: colors.warningLight,
        dotColor: colors.warning,
        textColor: colors.warning,
        label: `${state.count} pending`,
      };
    case 'offline':
      return {
        bg: colors.surfaceSecondary,
        dotColor: colors.textTertiary,
        textColor: colors.textTertiary,
        label: 'Offline',
      };
    case 'failed':
      return {
        bg: colors.errorLight,
        dotColor: colors.error,
        textColor: colors.error,
        label: `${state.count} failed`,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
