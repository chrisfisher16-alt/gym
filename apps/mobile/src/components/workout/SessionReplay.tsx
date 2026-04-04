import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { formatDuration } from '../../lib/workout-utils';
import { workoutFinished } from '../../lib/haptics';
import { useProfileStore } from '../../stores/profile-store';
import type { CompletedSession, CompletedExercise } from '../../types/workout';

// ── Constants ────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_STAGGER_MS = 400;
const TITLE_DURATION_MS = 1000;
const STATS_DELAY_MS = 800; // delay after last card before stats start
const CELEBRATION_DELAY_MS = 1500; // delay after stats before celebration
const CONFETTI_COUNT = 24;
const GOLD_CONFETTI_COLORS = ['#FFD700', '#FFC107', '#F5C842', '#C4A265', '#D4B97A', '#E8C547'];

// ── Types ────────────────────────────────────────────────────────────

export interface SessionReplayProps {
  session: CompletedSession;
  onComplete: () => void;
  onSkip: () => void;
}

// ── Animated Counter Hook ────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1200): number {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, active]);

  return display;
}

// ── Gold Confetti ────────────────────────────────────────────────────

interface ConfettiPiece {
  x: number;
  delay: number;
  rotation: number;
  size: number;
  color: string;
  duration: number;
  xDrift: number;
}

function generateGoldConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    delay: Math.random() * 500,
    rotation: Math.random() * 360,
    size: 5 + Math.random() * 7,
    color: GOLD_CONFETTI_COLORS[Math.floor(Math.random() * GOLD_CONFETTI_COLORS.length)],
    duration: 1600 + Math.random() * 800,
    xDrift: (Math.random() - 0.5) * 120,
  }));
}

function GoldConfetti({ visible }: { visible: boolean }) {
  const pieces = useMemo(() => generateGoldConfetti(), []);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <ConfettiDot key={i} piece={piece} />
      ))}
    </View>
  );
}

function ConfettiDot({ piece }: { piece: ConfettiPiece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: piece.x + progress.value * piece.xDrift,
    top: -10 + progress.value * 500,
    width: piece.size,
    height: piece.size,
    borderRadius: piece.size / 2,
    backgroundColor: piece.color,
    opacity: progress.value < 0.1 ? progress.value * 10 : progress.value > 0.75 ? (1 - progress.value) * 4 : 1,
    transform: [{ rotate: `${piece.rotation + progress.value * 540}deg` }],
  }));

  return <Animated.View style={style} />;
}

// ── Replay Exercise Card ─────────────────────────────────────────────

interface ReplayExerciseCardProps {
  exercise: CompletedExercise;
  index: number;
  skipped: boolean;
}

function ReplayExerciseCard({ exercise, index, skipped }: ReplayExerciseCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';

  const completedSets = exercise.sets.length;
  const hasPR = exercise.sets.some((s) => s.isPR);

  // Find the best set (highest weight, or highest reps if bodyweight)
  const bestSet = useMemo(() => {
    if (exercise.sets.length === 0) return null;
    let best = exercise.sets[0];
    for (const s of exercise.sets) {
      const sWeight = s.weight ?? 0;
      const bestWeight = best.weight ?? 0;
      if (sWeight > bestWeight || (sWeight === bestWeight && (s.reps ?? 0) > (best.reps ?? 0))) {
        best = s;
      }
    }
    return best;
  }, [exercise.sets]);

  // Gold border pulse for PR cards
  const borderGlow = useSharedValue(0);

  useEffect(() => {
    if (hasPR && !skipped) {
      borderGlow.value = withDelay(
        100,
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.4, { duration: 400 }),
          withTiming(0.6, { duration: 300 }),
        ),
      );
    } else if (hasPR && skipped) {
      borderGlow.value = 0.6;
    }
  }, [hasPR, skipped]);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: hasPR
      ? `rgba(196, 162, 101, ${0.3 + borderGlow.value * 0.7})`
      : colors.border,
    borderWidth: hasPR ? 1.5 : 1,
  }));

  const bestSetLabel = bestSet
    ? bestSet.durationSeconds
      ? `${bestSet.durationSeconds}s`
      : `${bestSet.weight ?? 0}${unit} × ${bestSet.reps ?? 0}`
    : '';

  const enterAnimation = skipped
    ? FadeIn.duration(100)
    : SlideInRight.delay(index * CARD_STAGGER_MS).springify().damping(18).stiffness(120);

  return (
    <Animated.View
      entering={enterAnimation}
      style={[styles.cardOuter]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: hasPR ? colors.goldLight : colors.surface,
            borderRadius: radius.md,
          },
          borderStyle,
        ]}
      >
        <View style={styles.cardContent}>
          {/* Left: index indicator */}
          <View
            style={[
              styles.cardIndex,
              {
                backgroundColor: hasPR ? colors.gold : colors.surfaceSecondary,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Text style={[typography.labelSmall, { color: hasPR ? colors.textInverse : colors.textSecondary }]}>
              {index + 1}
            </Text>
          </View>

          {/* Center: exercise info */}
          <View style={[styles.cardInfo, { marginLeft: spacing.sm }]}>
            <Text
              style={[typography.label, { color: colors.text }]}
              numberOfLines={1}
            >
              {exercise.exerciseName}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {completedSets} set{completedSets !== 1 ? 's' : ''}
              {bestSetLabel ? ` · Best: ${bestSetLabel}` : ''}
            </Text>
          </View>

          {/* Right: PR badge */}
          {hasPR && (
            <Animated.View
              entering={skipped ? FadeIn.duration(100) : ZoomIn.delay(index * CARD_STAGGER_MS + 200).springify()}
              style={[styles.prBadge, { backgroundColor: colors.gold, borderRadius: radius.full }]}
            >
              <Text style={styles.prBadgeText}>🏆 PR</Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Session Replay Component ─────────────────────────────────────────

export function SessionReplay({ session, onComplete, onSkip }: SessionReplayProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';
  const [phase, setPhase] = useState<'title' | 'cards' | 'stats' | 'celebration' | 'done'>('title');
  const [skipped, setSkipped] = useState(false);
  const [visibleCardCount, setVisibleCardCount] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const completedExercises = useMemo(() =>
    session.exercises.filter(e => e.sets.length > 0),
    [session.exercises]
  );
  const skippedExercises = useMemo(() =>
    session.exercises.filter(e => e.sets.length === 0),
    [session.exercises]
  );
  const [skippedExpanded, setSkippedExpanded] = useState(false);

  const exerciseCount = completedExercises.length;
  const hasPRs = session.prCount > 0;

  // Clean up all timers
  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  // Schedule a timeout and track it for cleanup
  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  // Progress through phases automatically
  useEffect(() => {
    if (skipped) return;

    // Title → Cards after 1s
    const t1 = schedule(() => {
      setPhase('cards');
      // Progressively reveal cards (max 8 visible at a time for perf)
      let revealed = 0;
      const maxCards = Math.min(exerciseCount, 8);
      const revealNext = () => {
        if (revealed >= maxCards) {
          // All cards shown, move to stats
          const statsDelay = STATS_DELAY_MS;
          schedule(() => setPhase('stats'), statsDelay);
          return;
        }
        revealed++;
        setVisibleCardCount(revealed);
        if (revealed < maxCards) {
          schedule(revealNext, CARD_STAGGER_MS);
        } else {
          schedule(() => setPhase('stats'), STATS_DELAY_MS);
        }
      };
      revealNext();
    }, TITLE_DURATION_MS);

    return () => clearTimers();
  }, [exerciseCount, skipped, schedule, clearTimers]);

  // Stats → Celebration → Done
  useEffect(() => {
    if (phase !== 'stats' || skipped) return;
    const t = schedule(() => {
      setPhase('celebration');
      if (hasPRs) workoutFinished();
      schedule(() => setPhase('done'), 1500);
    }, CELEBRATION_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, hasPRs, skipped, schedule]);

  // Handle skip: jump to done immediately
  const handleSkip = useCallback(() => {
    clearTimers();
    setSkipped(true);
    setVisibleCardCount(Math.min(completedExercises.length, 8));
    setPhase('done');
    onSkip();
  }, [completedExercises.length, clearTimers, onSkip]);

  // Tap anywhere to fast-forward
  const handleTapToSkip = useCallback(() => {
    if (phase === 'done') return;
    handleSkip();
  }, [phase, handleSkip]);

  // Stats display
  const statsActive = phase === 'stats' || phase === 'celebration' || phase === 'done';
  const volumeDisplay = useCountUp(session.totalVolume, statsActive);
  const setsDisplay = useCountUp(session.totalSets, statsActive);

  // Celebration message
  const celebrationMessage = useMemo(() => {
    if (session.prCount > 0 && session.totalSets >= 20) {
      return 'Incredible session! Records smashed!';
    }
    if (session.prCount > 0) return 'New personal records!';
    if (session.totalSets >= 20) return 'Beast mode activated!';
    if (session.durationSeconds >= 3600) return 'Solid grind!';
    return 'Great workout!';
  }, [session]);

  const showCards = phase !== 'title';
  const showStats = statsActive;
  const showCelebration = phase === 'celebration' || phase === 'done';
  const showDoneButton = phase === 'done';

  // Only render visible cards for performance (completed exercises only)
  const visibleExercises = useMemo(() => {
    if (skipped) return completedExercises.slice(0, 8);
    return completedExercises.slice(0, visibleCardCount);
  }, [completedExercises, visibleCardCount, skipped]);

  // Overflow indicator (only from completed exercises)
  const hiddenCount = completedExercises.length > 8 ? completedExercises.length - 8 : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Pressable style={styles.tapArea} onPress={handleTapToSkip}>
        {/* Skip button */}
        <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.skipContainer}>
          <TouchableOpacity
            onPress={handleSkip}
            style={[styles.skipButton, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Title */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.titleContainer, { paddingHorizontal: spacing.xl }]}
        >
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center' }]}>
            {session.name}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
            {new Date(session.completedAt).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </Animated.View>

        {/* Exercise Cards */}
        {showCards && (
          <ScrollView
            style={styles.cardList}
            contentContainerStyle={[styles.cardListContent, { paddingHorizontal: spacing.base }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={phase === 'done' || skipped}
          >
            {visibleExercises.map((exercise, index) => (
              <ReplayExerciseCard
                key={exercise.exerciseId + index}
                exercise={exercise}
                index={index}
                skipped={skipped}
              />
            ))}
            {hiddenCount > 0 && (
              <Animated.View entering={skipped ? FadeIn.duration(100) : FadeIn.delay(visibleCardCount * CARD_STAGGER_MS)}>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },
                  ]}
                >
                  +{hiddenCount} more exercise{hiddenCount !== 1 ? 's' : ''}
                </Text>
              </Animated.View>
            )}

            {/* Skipped exercises collapsible row */}
            {skippedExercises.length > 0 && (phase === 'done' || skipped || phase === 'stats' || phase === 'celebration') && (
              <Animated.View entering={skipped ? FadeIn.duration(100) : FadeIn.delay(Math.min(visibleCardCount, 8) * CARD_STAGGER_MS + 200)}>
                <TouchableOpacity
                  onPress={() => setSkippedExpanded(prev => !prev)}
                  activeOpacity={0.7}
                  style={[
                    styles.skippedRow,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.md,
                      marginTop: spacing.sm,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.textTertiary, flex: 1 }]}>
                    {skippedExercises.length} exercise{skippedExercises.length !== 1 ? 's' : ''} skipped
                  </Text>
                  <Ionicons
                    name={skippedExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>

                {skippedExpanded && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: spacing.xs }}>
                    {skippedExercises.map((exercise, idx) => (
                      <View
                        key={exercise.exerciseId + '-skipped-' + idx}
                        style={[
                          styles.skippedItem,
                          { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
                        ]}
                      >
                        <Ionicons
                          name="remove-circle-outline"
                          size={16}
                          color={colors.textTertiary}
                          style={{ marginRight: spacing.xs }}
                        />
                        <Text
                          style={[typography.caption, { color: colors.textTertiary }]}
                          numberOfLines={1}
                        >
                          {exercise.exerciseName}
                        </Text>
                      </View>
                    ))}
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </ScrollView>
        )}

        {/* Stats Row */}
        {showStats && (
          <Animated.View
            entering={skipped ? FadeIn.duration(100) : FadeInDown.duration(500).springify()}
            style={[
              styles.statsRow,
              {
                paddingHorizontal: spacing.base,
                paddingVertical: spacing.md,
                borderTopColor: colors.borderLight,
              },
            ]}
          >
            <View style={styles.statItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Volume</Text>
              <Text style={[typography.statValue, { color: colors.text }]}>
                {(skipped ? session.totalVolume : volumeDisplay).toLocaleString()}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>{unit}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.statItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Duration</Text>
              <Text style={[typography.statValue, { color: colors.text }]}>
                {formatDuration(session.durationSeconds)}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.statItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Sets</Text>
              <Text style={[typography.statValue, { color: colors.text }]}>
                {skipped ? session.totalSets : setsDisplay}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Celebration */}
        {showCelebration && (
          <Animated.View
            entering={skipped ? FadeIn.duration(100) : FadeIn.duration(400)}
            style={styles.celebrationContainer}
          >
            {hasPRs && (
              <Text style={[typography.label, { color: colors.gold, textAlign: 'center', marginBottom: spacing.xs }]}>
                🏆 {session.prCount} Personal Record{session.prCount !== 1 ? 's' : ''}!
              </Text>
            )}
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              {celebrationMessage}
            </Text>
          </Animated.View>
        )}

        {/* Gold confetti for PRs */}
        {showCelebration && hasPRs && !skipped && <GoldConfetti visible />}
      </Pressable>

      {/* View Summary button */}
      {showDoneButton && (
        <Animated.View
          entering={skipped ? FadeIn.duration(100) : FadeInDown.delay(200).duration(400).springify()}
          style={[styles.doneContainer, { paddingHorizontal: spacing.base, paddingBottom: spacing.base }]}
        >
          <TouchableOpacity
            onPress={onComplete}
            style={[
              styles.doneButton,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[typography.label, { color: colors.textOnPrimary }]}>View Summary</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tapArea: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  cardList: {
    flex: 1,
  },
  cardListContent: {
    paddingBottom: 16,
  },
  cardOuter: {
    marginBottom: 8,
  },
  card: {
    padding: 12,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIndex: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  prBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  doneContainer: {
    // outside tapArea so it doesn't trigger skip
  },
  doneButton: {
    alignItems: 'center',
  },
  skippedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  skippedItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
