import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { milestoneEarned } from '../../lib/haptics';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// ── Types ──────────────────────────────────────────────────────────

export interface CelebrationOverlayProps {
  type: 'pr' | 'levelup' | 'streak' | 'achievement';
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

// ── Constants ──────────────────────────────────────────────────────

const CONFETTI_COUNT = 25;

const GOLD_PALETTE = [
  '#C4A265',
  '#D4B97A',
  '#A8874E',
  '#E8D5A3',
  '#F5EFE0',
  '#B8962E',
  '#DCC48B',
] as const;

// ── Confetti Particle ──────────────────────────────────────────────

interface ConfettiParticleProps {
  index: number;
  colors: typeof GOLD_PALETTE;
  screenWidth: number;
  screenHeight: number;
}

function ConfettiParticle({ index, colors, screenWidth, screenHeight }: ConfettiParticleProps) {
  const config = useMemo(() => ({
    x: Math.random() * screenWidth,
    size: 6 + Math.random() * 6,
    color: colors[index % colors.length],
    fallDuration: 2000 + Math.random() * 2000,
    startDelay: Math.random() * 400,
    rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2),
    isCircle: Math.random() > 0.5,
    swayAmount: 20 + Math.random() * 30,
  }), [index, colors, screenWidth]);

  const translateY = useSharedValue(-20);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      config.startDelay,
      withTiming(screenHeight + 40, {
        duration: config.fallDuration,
        easing: Easing.in(Easing.quad),
      }),
    );
    rotation.value = withDelay(
      config.startDelay,
      withRepeat(
        withTiming(360 * config.rotationSpeed, {
          duration: config.fallDuration,
          easing: Easing.linear,
        }),
        -1,
      ),
    );
    opacity.value = withDelay(
      config.startDelay + config.fallDuration * 0.7,
      withTiming(0, { duration: config.fallDuration * 0.3 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: config.x,
          top: -20,
          width: config.size,
          height: config.isCircle ? config.size : config.size * 1.5,
          backgroundColor: config.color,
          borderRadius: config.isCircle ? config.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

// ── Static Content (reduced motion) ───────────────────────────────

function StaticContent({ type, title, subtitle }: { type: CelebrationOverlayProps['type']; title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();

  const icon: keyof typeof Ionicons.glyphMap =
    type === 'pr' ? 'trophy' :
    type === 'levelup' ? 'arrow-up-circle' :
    type === 'streak' ? 'flame' :
    'ribbon';

  return (
    <View style={styles.contentCenter}>
      <Ionicons name={icon} size={56} color={colors.gold} />
      <Text style={[typography.displayLarge, styles.title, { color: colors.gold }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textInverse }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ── PR Celebration ─────────────────────────────────────────────────

function PRContent({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const titleScale = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    titleScale.value = withSpring(1, { damping: 10, stiffness: 120 });
    subtitleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <>
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiParticle key={i} index={i} colors={GOLD_PALETTE} screenWidth={screenWidth} screenHeight={screenHeight} />
      ))}
      <View style={styles.contentCenter}>
        <Animated.View style={titleStyle}>
          <Ionicons name="trophy" size={56} color={colors.gold} />
          <Text style={[typography.displayLarge, styles.title, { color: colors.gold }]}>
            {title}
          </Text>
        </Animated.View>
        {subtitle ? (
          <Animated.View style={subtitleStyle}>
            <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textInverse }]}>
              {subtitle}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </>
  );
}

// ── Level Up Celebration ───────────────────────────────────────────

function LevelUpContent({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();

  const ring1Scale = useSharedValue(0);
  const ring2Scale = useSharedValue(0);
  const ring3Scale = useSharedValue(0);
  const ring1Opacity = useSharedValue(0.6);
  const ring2Opacity = useSharedValue(0.6);
  const ring3Opacity = useSharedValue(0.6);
  const titleScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Staggered expanding rings
    ring1Scale.value = withTiming(3, { duration: 1200, easing: Easing.out(Easing.quad) });
    ring1Opacity.value = withDelay(400, withTiming(0, { duration: 800 }));

    ring2Scale.value = withDelay(200, withTiming(3, { duration: 1200, easing: Easing.out(Easing.quad) }));
    ring2Opacity.value = withDelay(600, withTiming(0, { duration: 800 }));

    ring3Scale.value = withDelay(400, withTiming(3, { duration: 1200, easing: Easing.out(Easing.quad) }));
    ring3Opacity.value = withDelay(800, withTiming(0, { duration: 800 }));

    // Title springs in
    titleScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 100 }));

    // Gold glow pulse
    glowOpacity.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600 }),
          withTiming(0.1, { duration: 600 }),
        ),
        3,
        true,
      ),
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring3Scale.value }],
    opacity: ring3Opacity.value,
  }));

  const titleStyleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const ringBase: object = {
    position: 'absolute' as const,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.gold,
  };

  return (
    <View style={styles.contentCenter}>
      {/* Concentric rings */}
      <Animated.View style={[ringBase, ring1Style]} />
      <Animated.View style={[ringBase, ring2Style]} />
      <Animated.View style={[ringBase, ring3Style]} />

      {/* Gold glow */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: colors.gold,
          },
          glowStyle,
        ]}
      />

      <Animated.View style={titleStyleAnim}>
        <Text style={[typography.displayLarge, styles.title, { color: colors.gold, fontSize: 48 }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textInverse }]}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ── Streak Celebration ─────────────────────────────────────────────

function StreakContent({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();

  const fireScale = useSharedValue(0.5);
  const titleScale = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    // Fire emoji pulse: scale up → down, 3 times, then hold
    fireScale.value = withSequence(
      withSpring(1.2, { damping: 6, stiffness: 200 }),
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: 300 }),
          withTiming(1.2, { duration: 300 }),
        ),
        3,
        true,
      ),
      withTiming(1.0, { duration: 200 }),
    );

    titleScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 120 }));
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
  }, []);

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  const titleStyleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: titleScale.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <View style={styles.contentCenter}>
      <Animated.View style={fireStyle}>
        <Text style={{ fontSize: 72 }}>🔥</Text>
      </Animated.View>
      <Animated.View style={titleStyleAnim}>
        <Text style={[typography.displayLarge, styles.title, { color: colors.gold }]}>
          {title}
        </Text>
      </Animated.View>
      {subtitle ? (
        <Animated.View style={subtitleStyle}>
          <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textInverse }]}>
            {subtitle}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ── Achievement Celebration ────────────────────────────────────────

function AchievementContent({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, typography } = useTheme();

  const badgeTranslateY = useSharedValue(-200);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    badgeTranslateY.value = withSpring(0, { damping: 12, stiffness: 100 });
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    subtitleOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  const titleStyleAnim = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  return (
    <View style={styles.contentCenter}>
      <Animated.View style={badgeStyle}>
        <View style={[styles.badgeCircle, { backgroundColor: colors.goldLight }]}>
          <Ionicons name="ribbon" size={48} color={colors.gold} />
        </View>
      </Animated.View>
      <Animated.View style={titleStyleAnim}>
        <Text style={[typography.h1, styles.title, { color: colors.gold }]}>
          {title}
        </Text>
      </Animated.View>
      {subtitle ? (
        <Animated.View style={subtitleStyle}>
          <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textInverse }]}>
            {subtitle}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function CelebrationOverlay({
  type,
  title,
  subtitle,
  onDismiss,
  autoDismissMs = 3000,
}: CelebrationOverlayProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    milestoneEarned();
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  const renderContent = () => {
    if (reduceMotion) {
      return <StaticContent type={type} title={title} subtitle={subtitle} />;
    }

    switch (type) {
      case 'pr':
        return <PRContent title={title} subtitle={subtitle} />;
      case 'levelup':
        return <LevelUpContent title={title} subtitle={subtitle} />;
      case 'streak':
        return <StreakContent title={title} subtitle={subtitle} />;
      case 'achievement':
        return <AchievementContent title={title} subtitle={subtitle} />;
    }
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      exiting={reduceMotion ? undefined : FadeOut.duration(200)}
      style={[styles.overlay, reduceMotion && { opacity: 1 }]}
    >
      <Pressable style={styles.pressable} onPress={onDismiss}>
        {renderContent()}
        <Text style={styles.tapHint}>Tap to dismiss</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 9999,
  },
  pressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  badgeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 60,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
});
