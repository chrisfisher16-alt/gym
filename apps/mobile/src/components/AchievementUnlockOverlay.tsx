import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAchievementsStore } from '../stores/achievements-store';
import { ACHIEVEMENTS, type Achievement } from '../lib/achievements';
import { successNotification } from '../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISPLAY_DURATION = 4000;
const BETWEEN_DELAY = 600;
const NUM_SPARKLES = 8;
const GOLD = '#FFD700';

// ── Sparkle Particle ──────────────────────────────────────────────

interface SparkleProps {
  delay: number;
  angle: number;
  distance: number;
}

function Sparkle({ delay, angle, distance }: SparkleProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const radians = (angle * Math.PI) / 180;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(radians) * distance],
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(radians) * distance],
  });
  const scale = anim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, 1.2, 1, 0],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.2, 0.7, 1],
    outputRange: [0, 1, 0.8, 0],
  });

  return (
    <Animated.View
      style={[
        styles.sparkle,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Ionicons name="sparkles" size={16} color={GOLD} />
    </Animated.View>
  );
}

// ── Single Achievement Display ────────────────────────────────────

interface AchievementCardProps {
  achievement: Achievement;
  onDone: () => void;
}

function AchievementCard({ achievement, onDone }: AchievementCardProps) {
  const { colors, spacing, typography } = useTheme();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryColors: Record<string, string> = {
    workout: colors.primary,
    nutrition: colors.success,
    streak: colors.warning,
    milestone: colors.info,
  };
  const accentColor = categoryColors[achievement.category] ?? colors.primary;

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(badgeScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [onDone]);

  useEffect(() => {
    // Fire haptic
    successNotification();

    // Entrance animation
    Animated.sequence([
      // Fade in overlay
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Bounce in badge
      Animated.spring(badgeScale, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: true,
      }),
      // Fade in text
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Auto-dismiss
    dismissTimer.current = setTimeout(dismiss, DISPLAY_DURATION);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // Generate sparkle configs
  const sparkles = Array.from({ length: NUM_SPARKLES }, (_, i) => ({
    angle: (360 / NUM_SPARKLES) * i + Math.random() * 20 - 10,
    distance: 50 + Math.random() * 30,
    delay: 200 + i * 60,
  }));

  return (
    <TouchableWithoutFeedback onPress={dismiss}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <View style={styles.content}>
          {/* Badge with sparkles */}
          <View style={styles.badgeArea}>
            {sparkles.map((s, i) => (
              <Sparkle key={i} angle={s.angle} distance={s.distance} delay={s.delay} />
            ))}
            <Animated.View
              style={[
                styles.badgeCircle,
                {
                  backgroundColor: accentColor + '25',
                  borderColor: GOLD,
                  transform: [{ scale: badgeScale }],
                },
              ]}
            >
              <Ionicons
                name={achievement.icon as any}
                size={48}
                color={GOLD}
              />
            </Animated.View>
          </View>

          {/* Label */}
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              alignItems: 'center',
            }}
          >
            <Text style={[styles.unlockLabel, { color: GOLD }]}>
              Achievement Unlocked!
            </Text>
            <Text
              style={[
                typography.h3,
                { color: colors.text, textAlign: 'center', marginTop: spacing.sm },
              ]}
            >
              {achievement.name}
            </Text>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                  paddingHorizontal: spacing.xl,
                },
              ]}
            >
              {achievement.description}
            </Text>
            <Text
              style={[
                styles.tapHint,
                { color: colors.textTertiary, marginTop: spacing.lg },
              ]}
            >
              Tap to dismiss
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ── Main Overlay (Queue Manager) ──────────────────────────────────

export function AchievementUnlockOverlay() {
  const newlyEarned = useAchievementsStore((s) => s.newlyEarned);
  const clearNewlyEarned = useAchievementsStore((s) => s.clearNewlyEarned);

  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const isProcessing = useRef(false);

  // When newlyEarned changes, resolve IDs to Achievement objects and enqueue
  useEffect(() => {
    if (newlyEarned.length === 0) return;

    const achievements = newlyEarned
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
      .filter((a): a is Achievement => a != null);

    if (achievements.length > 0) {
      setQueue((prev) => [...prev, ...achievements]);
    }

    // Clear immediately so the store doesn't re-trigger
    clearNewlyEarned();
  }, [newlyEarned]);

  // Process queue: show one at a time
  useEffect(() => {
    if (current || queue.length === 0 || isProcessing.current) return;

    isProcessing.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);

    // Small delay between consecutive achievements
    const delay = isProcessing.current ? BETWEEN_DELAY : 0;
    const timer = setTimeout(() => {
      setCurrent(next);
      isProcessing.current = false;
    }, delay);

    return () => clearTimeout(timer);
  }, [queue, current]);

  const handleDone = useCallback(() => {
    setCurrent(null);
  }, []);

  if (!current) return null;

  return <AchievementCard key={current.id} achievement={current} onDone={handleDone} />;
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  badgeArea: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  badgeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  unlockLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tapHint: {
    fontSize: 13,
    fontWeight: '400',
  },
});
