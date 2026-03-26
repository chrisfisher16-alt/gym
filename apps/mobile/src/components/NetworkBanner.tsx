import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

// ── Imperative API ───────────────────────────────────────────────────
// Call showNetworkError() from anywhere (e.g. after a failed Supabase call)
// to briefly display the banner.

let showBannerFn: ((msg: string) => void) | null = null;

export function showNetworkError(message: string = 'No internet connection') {
  showBannerFn?.(message);
}

// ── Component ────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 4000;

export function NetworkBanner() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const translateY = useRef(new Animated.Value(-80)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -80,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setMessage(null));
  }, [translateY]);

  const show = useCallback(
    (msg: string) => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setMessage(msg);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    },
    [translateY],
  );

  // Register the imperative handle
  useEffect(() => {
    showBannerFn = show;
    return () => {
      showBannerFn = null;
    };
  }, [show]);

  // Track network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Auto-dismiss only when back online
  useEffect(() => {
    if (message && isOnline) {
      const timer = setTimeout(hide, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, isOnline, hide]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.warningLight,
          borderBottomColor: colors.warning + '40',
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.base,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <Text
        style={[
          typography.label,
          { color: colors.warning, marginLeft: spacing.xs, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9998,
    elevation: 9998,
    borderBottomWidth: 1,
  },
});
