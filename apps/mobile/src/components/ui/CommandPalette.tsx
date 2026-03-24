import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme } from '../../theme';
import { lightImpact } from '../../lib/haptics';
import { fuzzyMatch, searchAll, type SearchResult, type SearchSource } from '../../lib/fuzzy-search';
import { useCommandPalette } from '../../providers/CommandPaletteProvider';

// ── Types ──────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SPRING_CONFIG = { damping: 20, stiffness: 150 };
const DISMISS_THRESHOLD = 80; // px swipe-down to dismiss

// ── Quick Action Definitions ───────────────────────────────────────

interface QuickActionDef {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  handler: 'navigate' | 'action';
  target?: string;
}

const QUICK_ACTIONS: QuickActionDef[] = [
  { id: 'qa_workout', label: 'Start a workout', icon: 'play', handler: 'navigate', target: '/(tabs)/workout' },
  { id: 'qa_meal', label: 'Log a meal', icon: 'restaurant', handler: 'navigate', target: '/(tabs)/nutrition' },
  { id: 'qa_water', label: 'Add water (8oz)', icon: 'water', handler: 'action' },
  { id: 'qa_weight', label: 'Log body weight', icon: 'scale', handler: 'navigate', target: '/progress' },
  { id: 'qa_coach', label: 'Ask the coach', icon: 'chatbubble-ellipses', handler: 'navigate', target: '/(tabs)/coach' },
];

// ── Settings Search Items ──────────────────────────────────────────

interface SettingItem {
  title: string;
  subtitle: string;
  target: string;
}

const SETTINGS_ITEMS: SettingItem[] = [
  { title: 'Profile', subtitle: 'Edit your profile', target: '/profile' },
  { title: 'Settings', subtitle: 'App settings', target: '/settings' },
  { title: 'Notifications', subtitle: 'Notification preferences', target: '/notifications' },
  { title: 'Health Integrations', subtitle: 'Apple Health, Health Connect', target: '/health-settings' },
  { title: 'AI Settings', subtitle: 'AI coach configuration', target: '/ai-settings' },
  { title: 'Privacy Policy', subtitle: 'Privacy information', target: '/privacy' },
  { title: 'Terms of Service', subtitle: 'Terms and conditions', target: '/terms' },
];

// ── Time-of-Day Suggestions ────────────────────────────────────────

interface TimeSuggestion {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  target?: string;
  actionId?: string;
}

function getTimeSuggestions(): TimeSuggestion[] {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 10) {
    return [
      { label: 'Log breakfast', icon: 'sunny', target: '/(tabs)/nutrition' },
      { label: 'Start workout', icon: 'barbell', target: '/(tabs)/workout' },
    ];
  }
  if (hour >= 10 && hour < 14) {
    return [
      { label: 'Log lunch', icon: 'restaurant', target: '/(tabs)/nutrition' },
    ];
  }
  if (hour >= 14 && hour < 17) {
    return [
      { label: 'Start workout', icon: 'barbell', target: '/(tabs)/workout' },
      { label: 'Add water', icon: 'water', actionId: 'qa_water' },
    ];
  }
  if (hour >= 17 && hour < 21) {
    return [
      { label: 'Log dinner', icon: 'restaurant', target: '/(tabs)/nutrition' },
      { label: 'Log weight', icon: 'scale', target: '/progress' },
    ];
  }
  // 9pm+ or before 5am
  return [
    { label: 'Ask the coach', icon: 'chatbubble-ellipses', target: '/(tabs)/coach' },
  ];
}

// ── Row Item Type ──────────────────────────────────────────────────

type RowItem =
  | { kind: 'header'; title: string; icon: string }
  | { kind: 'action'; id: string; label: string; icon: string; onPress: () => void; disabled?: boolean }
  | { kind: 'result'; result: SearchResult };

// ── Component ──────────────────────────────────────────────────────

export function CommandPalette({ visible, onClose }: CommandPaletteProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recentActions } = useCommandPalette();

  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // ── Animations ───────────────────────────────────────────────────

  const translateY = useSharedValue(-SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue(0);

  const animateOpen = useCallback(() => {
    translateY.value = -SCREEN_HEIGHT;
    translateY.value = withSpring(0, SPRING_CONFIG);
    backdropOpacity.value = withTiming(0.5, { duration: 200 });
  }, [translateY, backdropOpacity]);

  const animateClose = useCallback(() => {
    Keyboard.dismiss();
    translateY.value = withSpring(-SCREEN_HEIGHT, {
      ...SPRING_CONFIG,
      stiffness: 200,
    });
    backdropOpacity.value = withTiming(0, { duration: 150 });
  }, [translateY, backdropOpacity]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSearchResults([]);
      animateOpen();
      // Auto-focus with slight delay for modal to mount
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    } else {
      animateClose();
    }
  }, [visible, animateOpen, animateClose]);

  // ── Swipe-to-dismiss ─────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((e) => {
      // Only allow upward dragging (negative = off-screen)
      translateY.value = Math.min(context.value + e.translationY, 0);
    })
    .onEnd((e) => {
      const pastThreshold = translateY.value < -DISMISS_THRESHOLD;
      const flicked = e.velocityY < -500;

      if (pastThreshold || flicked) {
        translateY.value = withSpring(-SCREEN_HEIGHT, {
          ...SPRING_CONFIG,
          stiffness: 200,
          velocity: e.velocityY,
        });
        backdropOpacity.value = withTiming(0, { duration: 150 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // ── Animated Styles ──────────────────────────────────────────────

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // ── Navigation Handlers ──────────────────────────────────────────

  const handleNavigate = useCallback(
    (target: string) => {
      lightImpact();
      onClose();
      // Slight delay to let close animation start
      setTimeout(() => router.push(target as never), 100);
    },
    [onClose, router],
  );

  const handleWaterAction = useCallback(() => {
    lightImpact();
    onClose();
    try {
      const { useNutritionStore } = require('../../stores/nutrition-store');
      useNutritionStore.getState().logWater(8);
    } catch {
      // Store not available — silently fail
    }
  }, [onClose]);

  const handleQuickAction = useCallback(
    (action: QuickActionDef) => {
      if (action.handler === 'action' && action.id === 'qa_water') {
        handleWaterAction();
      } else if (action.target) {
        handleNavigate(action.target);
      }
    },
    [handleNavigate, handleWaterAction],
  );

  // ── Search Sources ───────────────────────────────────────────────

  const searchSources = useMemo((): SearchSource[] => {
    const sources: SearchSource[] = [];

    // Exercises from workout store
    try {
      const { useWorkoutStore } = require('../../stores/workout-store');
      const exercises = useWorkoutStore.getState().exercises;
      if (exercises?.length) {
        sources.push({
          type: 'exercise',
          items: exercises.map((ex: { name: string; category: string; id: string }) => ({
            title: ex.name,
            subtitle: ex.category,
            icon: 'barbell-outline' as const,
            onSelect: () => handleNavigate('/(tabs)/workout'),
          })),
        });
      }
    } catch {
      // Store not available
    }

    // Saved meals from nutrition store
    try {
      const { useNutritionStore } = require('../../stores/nutrition-store');
      const state = useNutritionStore.getState();
      const savedMeals = state.savedMeals;
      if (savedMeals?.length) {
        sources.push({
          type: 'meal',
          items: savedMeals.map((m: { name: string; mealType: string }) => ({
            title: m.name,
            subtitle: m.mealType,
            icon: 'restaurant-outline' as const,
            onSelect: () => handleNavigate('/(tabs)/nutrition'),
          })),
        });
      }
    } catch {
      // Store not available
    }

    // Completed workouts from workout store history
    try {
      const { useWorkoutStore } = require('../../stores/workout-store');
      const history = useWorkoutStore.getState().history;
      if (history?.length) {
        // Deduplicate by name, take most recent
        const seen = new Set<string>();
        const unique = history.filter((s: { name: string }) => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
        sources.push({
          type: 'workout',
          items: unique.slice(0, 30).map((s: { name: string; completedAt: string }) => ({
            title: s.name,
            subtitle: new Date(s.completedAt).toLocaleDateString(),
            icon: 'fitness-outline' as const,
            onSelect: () => handleNavigate('/(tabs)/workout'),
          })),
        });
      }
    } catch {
      // Store not available
    }

    // Settings
    sources.push({
      type: 'setting',
      items: SETTINGS_ITEMS.map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        icon: 'settings-outline' as const,
        onSelect: () => handleNavigate(item.target),
      })),
    });

    // Quick actions (searchable)
    sources.push({
      type: 'action',
      items: QUICK_ACTIONS.map((qa) => ({
        title: qa.label,
        icon: qa.icon,
        onSelect: () => handleQuickAction(qa),
      })),
    });

    return sources;
  }, [handleNavigate, handleQuickAction]);

  // ── Search Handler ───────────────────────────────────────────────

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (text.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      const results = searchAll(text, searchSources);
      setSearchResults(results);
    },
    [searchSources],
  );

  // ── Build Row Data ───────────────────────────────────────────────

  const rows = useMemo((): RowItem[] => {
    const items: RowItem[] = [];
    const hasQuery = query.trim().length > 0;

    if (hasQuery && searchResults.length > 0) {
      items.push({ kind: 'header', title: 'Results', icon: 'search' });
      for (const r of searchResults) {
        items.push({ kind: 'result', result: r });
      }
      return items;
    }

    if (hasQuery && searchResults.length === 0) {
      // No results — still show filtered quick actions
      const filtered = QUICK_ACTIONS.filter(
        (qa) => fuzzyMatch(query, qa.label) >= 0.3,
      );
      if (filtered.length > 0) {
        items.push({ kind: 'header', title: 'Quick Actions', icon: 'flash' });
        for (const qa of filtered) {
          items.push({
            kind: 'action',
            id: qa.id,
            label: qa.label,
            icon: qa.icon,
            onPress: () => handleQuickAction(qa),
          });
        }
      }
      return items;
    }

    // Default view (no query)

    // Time-of-day suggestions
    const timeSuggestions = getTimeSuggestions();
    if (timeSuggestions.length > 0) {
      items.push({ kind: 'header', title: 'Suggested', icon: 'time' });
      for (const ts of timeSuggestions) {
        items.push({
          kind: 'action',
          id: `ts_${ts.label}`,
          label: ts.label,
          icon: ts.icon,
          onPress: () => {
            if (ts.actionId === 'qa_water') {
              handleWaterAction();
            } else if (ts.target) {
              handleNavigate(ts.target);
            }
          },
        });
      }
    }

    // Quick actions
    items.push({ kind: 'header', title: 'Quick Actions', icon: 'flash' });
    for (const qa of QUICK_ACTIONS) {
      items.push({
        kind: 'action',
        id: qa.id,
        label: qa.label,
        icon: qa.icon,
        onPress: () => handleQuickAction(qa),
      });
    }

    // Recent actions
    if (recentActions.length > 0) {
      items.push({ kind: 'header', title: 'Recent', icon: 'time-outline' });
      for (const ra of recentActions) {
        items.push({
          kind: 'action',
          id: `recent_${ra.timestamp}`,
          label: ra.label,
          icon: ra.icon,
          onPress: () => {}, // Informational — tap the action directly from its section above
          disabled: true,
        });
      }
    }

    return items;
  }, [query, searchResults, recentActions, handleQuickAction, handleNavigate, handleWaterAction]);

  // ── Render Row ───────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => {
      if (item.kind === 'header') {
        return (
          <View style={[styles.sectionHeader, { paddingHorizontal: spacing.lg }]}>
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={colors.textTertiary}
              style={{ marginRight: spacing.sm }}
            />
            <Text
              style={[
                typography.overline,
                { color: colors.textTertiary, textTransform: 'uppercase' },
              ]}
            >
              {item.title}
            </Text>
          </View>
        );
      }

      if (item.kind === 'action') {
        return (
          <Pressable
            onPress={item.onPress}
            disabled={item.disabled}
            style={({ pressed }) => [
              styles.row,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                opacity: item.disabled ? 0.5 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.surfaceSecondary,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                },
              ]}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={item.disabled ? colors.textTertiary : colors.primary}
              />
            </View>
            <Text
              style={[typography.label, { color: item.disabled ? colors.textTertiary : colors.text, marginLeft: spacing.md }]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      }

      // Search result
      const { result } = item;
      const typeLabel =
        result.type === 'exercise'
          ? 'Exercise'
          : result.type === 'meal'
            ? 'Meal'
            : result.type === 'workout'
              ? 'Workout'
              : result.type === 'setting'
                ? 'Settings'
                : 'Action';

      return (
        <Pressable
          onPress={result.onSelect}
          style={({ pressed }) => [
            styles.row,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.surfaceSecondary,
                width: 36,
                height: 36,
                borderRadius: 18,
              },
            ]}
          >
            <Ionicons
              name={result.icon}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
              {result.title}
            </Text>
            {result.subtitle ? (
              <Text
                style={[typography.bodySmall, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {result.subtitle}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: colors.primaryMuted,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              },
            ]}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>{typeLabel}</Text>
          </View>
        </Pressable>
      );
    },
    [colors, typography, spacing, radius],
  );

  const keyExtractor = useCallback((item: RowItem, index: number) => {
    if (item.kind === 'header') return `header_${item.title}`;
    if (item.kind === 'action') return item.id;
    return `result_${item.result.title}_${index}`;
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
          />
        </Pressable>

        {/* Panel — slides down from top */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.panel,
              panelStyle,
              {
                backgroundColor: colors.surface,
                paddingTop: insets.top + spacing.sm,
                borderBottomLeftRadius: radius.sheet,
                borderBottomRightRadius: radius.sheet,
                maxHeight: SCREEN_HEIGHT * 0.75,
                shadowColor: colors.shadow,
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
            </View>

            {/* Search input */}
            <View
              style={[
                styles.searchContainer,
                {
                  marginHorizontal: spacing.lg,
                  marginBottom: spacing.md,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              <Ionicons
                name="search"
                size={20}
                color={colors.textTertiary}
                style={{ marginRight: spacing.sm }}
              />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={handleSearch}
                placeholder="What do you want to do?"
                placeholderTextColor={colors.textTertiary}
                style={[
                  typography.body,
                  styles.searchInput,
                  { color: colors.text },
                ]}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {query.length > 0 && Platform.OS !== 'ios' && (
                <Pressable onPress={() => handleSearch('')} hitSlop={12}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>

            {/* Content list */}
            <FlatList
              data={rows}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              ListEmptyComponent={
                query.trim().length > 0 ? (
                  <View style={[styles.emptyState, { padding: spacing['2xl'] }]}>
                    <Ionicons name="search-outline" size={32} color={colors.textTertiary} />
                    <Text
                      style={[
                        typography.body,
                        { color: colors.textTertiary, marginTop: spacing.md, textAlign: 'center' },
                      ]}
                    >
                      No results for "{query}"
                    </Text>
                  </View>
                ) : null
              }
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
