import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

// ── Types ─────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

// ── Context ───────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Icons ─────────────────────────────────────────────────────────────

const VARIANT_ICONS: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

// ── Toast View ────────────────────────────────────────────────────────

function ToastView({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : -100)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  const variantColors: Record<ToastVariant, { bg: string; text: string; icon: string }> = {
    success: { bg: colors.successLight, text: colors.success, icon: colors.success },
    error: { bg: colors.errorLight, text: colors.error, icon: colors.error },
    info: { bg: colors.infoLight, text: colors.info, icon: colors.info },
    warning: { bg: colors.warningLight, text: colors.warning, icon: colors.warning },
  };

  const vc = variantColors[toast.variant];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(toast.message);

    if (reduceMotion) {
      // Skip entrance animation — already visible via initial values
      const timer = setTimeout(() => {
        opacity.setValue(0);
        onDismiss();
      }, toast.duration ?? 3000);
      return () => clearTimeout(timer);
    }

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, toast.duration ?? 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: vc.bg,
          borderRadius: radius.lg,
          marginHorizontal: spacing.base,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          top: insets.top + spacing.sm,
          transform: [{ translateY }],
          opacity,
          borderWidth: 1,
          borderColor: vc.text + '30',
        },
      ]}
    >
      <Ionicons name={VARIANT_ICONS[toast.variant]} size={20} color={vc.icon} />
      <Text
        style={[
          typography.label,
          { color: vc.text, flex: 1, marginLeft: spacing.sm },
        ]}
        numberOfLines={2}
      >
        {toast.message}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={18} color={vc.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Provider ──────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', duration?: number) => {
      const id = `toast-${++counterRef.current}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, variant, duration }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});
