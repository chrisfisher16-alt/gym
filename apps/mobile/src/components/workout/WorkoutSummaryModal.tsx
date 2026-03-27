import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useProfileStore } from '../../stores/profile-store';
import { useFeedbackStore } from '../../stores/feedback-store';
import { useFeedStore } from '../../stores/feed-store';
import { useWorkoutStore } from '../../stores/workout-store';
import { BottomSheet, Button, StatCard } from '../ui';
import { MuscleAnatomyDiagram } from '../MuscleAnatomyDiagram';
import type { MuscleHighlight } from '../MuscleAnatomyDiagram';
import { getMuscleDiagramData } from '../../lib/exercise-media';
import { formatDuration } from '../../lib/workout-utils';
import { estimateCaloriesBurned, formatCalorieEstimate } from '../../lib/calorie-estimation';
import { getWatchCalories } from '../../lib/health/workout-calories';
import { successNotification } from '../../lib/haptics';
import { FeedbackSheet } from '../FeedbackSheet';
import type { CompletedSession } from '../../types/workout';

// ── Confetti Burst ──────────────────────────────────────────────────

const CONFETTI_COUNT = 30;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONFETTI_COLORS = ['#FFD700', '#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#FF7675'];

interface ConfettiPieceData {
  x: number;
  delay: number;
  rotation: number;
  size: number;
  color: string;
  duration: number;
  xDrift: number[];
}

function generateConfetti(): ConfettiPieceData[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * SCREEN_WIDTH,
    delay: Math.random() * 600,
    rotation: Math.random() * 360,
    size: 6 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    duration: 1800 + Math.random() * 1200,
    xDrift: [(Math.random() - 0.5) * 80, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 160],
  }));
}

function ConfettiBurst({ visible }: { visible: boolean }) {
  const confetti = useMemo(() => generateConfetti(), []);
  const anims = useRef(confetti.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) {
      anims.forEach((a) => a.setValue(0));
      return;
    }
    const animations = anims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(confetti[i].delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: confetti[i].duration,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.parallel(animations).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {confetti.map((piece, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 600],
        });
        const translateX = anims[i].interpolate({
          inputRange: [0, 0.3, 0.6, 1],
          outputRange: [0, piece.xDrift[0], piece.xDrift[1], piece.xDrift[2]],
        });
        const rotate = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [`${piece.rotation}deg`, `${piece.rotation + 540}deg`],
        });
        const opacity = anims[i].interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1, 1, 0],
        });

        return (
          <Animated.View
            key={`confetti-${i}`}
            style={{
              position: 'absolute',
              left: piece.x,
              top: 0,
              width: piece.size,
              height: piece.size,
              backgroundColor: piece.color,
              borderRadius: piece.size > 9 ? 2 : 0,
              transform: [{ translateY }, { translateX }, { rotate }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Animated Counter Hook ───────────────────────────────────────────

function useAnimatedCounter(value: number, active: boolean, duration = 1000): number {
  const [display, setDisplay] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, duration, active]);

  return display;
}

export interface WorkoutSummaryModalProps {
  visible: boolean;
  session: CompletedSession | null;
  onDone: () => void;
}

export function WorkoutSummaryModal({
  visible,
  session,
  onDone,
}: WorkoutSummaryModalProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const profileWeightKg = useProfileStore((s) => s.profile.weightKg);
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const weightUnit = unitPref === 'metric' ? 'kg' : 'lbs';

  const history = useWorkoutStore((s) => s.history);
  const exercises = useWorkoutStore((s) => s.exercises);

  const [watchCalories, setWatchCalories] = useState<{ calories: number; source: string } | null>(null);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [postedToFeed, setPostedToFeed] = useState(false);
  const postWorkoutCompletion = useFeedStore((s) => s.postWorkoutCompletion);
  const shouldShowPrompt = useFeedbackStore((s) => s.shouldShowPrompt);
  const recordPromptShown = useFeedbackStore((s) => s.recordPromptShown);
  const showPrompt = useMemo(() => shouldShowPrompt(), [visible]);

  // Celebration animations
  const headingScale = useRef(new Animated.Value(0)).current;
  const [countersActive, setCountersActive] = useState(false);

  useEffect(() => {
    if (visible && showPrompt) {
      recordPromptShown();
    }
  }, [visible, showPrompt]);

  useEffect(() => {
    if (!session || !visible) return;
    let cancelled = false;
    getWatchCalories(session.startedAt, session.completedAt).then((result) => {
      if (!cancelled && result) setWatchCalories(result);
    });
    return () => { cancelled = true; };
  }, [session?.id, visible]);

  // Reset mood and feed post state when modal opens with a new session
  useEffect(() => {
    if (visible) {
      setSelectedMood(null);
      setPostedToFeed(false);
    }
  }, [visible]);

  // Celebration effects when modal appears
  useEffect(() => {
    if (visible && session) {
      successNotification();

      // Scale-bounce heading entrance
      headingScale.setValue(0);
      Animated.spring(headingScale, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
        delay: 200,
      }).start();

      // Start counter animations after brief delay
      const timer = setTimeout(() => setCountersActive(true), 300);
      return () => clearTimeout(timer);
    } else {
      headingScale.setValue(0);
      setCountersActive(false);
    }
  }, [visible, session?.id]);

  if (!session) return null;

  const calorieResult = estimateCaloriesBurned({
    session,
    bodyWeightKg: profileWeightKg ?? 75,
  });

  const displayCalories = watchCalories ? watchCalories.calories : calorieResult.estimated;
  const calorieLabel = watchCalories ? `${watchCalories.source}` : profileWeightKg ? 'Est. Burned' : 'Est. Burned (75kg default)';

  const exercisesDone = session.exercises.length;
  const durationDisplay = formatDuration(session.durationSeconds);

  // Total distance across all sets
  const totalDistance = useMemo(() => {
    if (!session) return null;
    let total = 0;
    let milesCount = 0;
    let kmCount = 0;
    let metersCount = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (s.distance != null && s.distance > 0) {
          total += s.distance;
          if (s.distanceUnit === 'km') kmCount++;
          else if (s.distanceUnit === 'meters') metersCount++;
          else milesCount++;
        }
      }
    }
    if (total === 0) return null;
    // Use the majority unit for display
    const majorityUnit = kmCount > milesCount && kmCount > metersCount
      ? 'km'
      : metersCount > milesCount && metersCount > kmCount
        ? 'm'
        : 'mi';
    return { value: Math.round(total * 10) / 10, unit: majorityUnit };
  }, [session]);

  // Active time: sum of all duration-based set durations
  const activeTimeSecs = useMemo(() => {
    if (!session) return 0;
    let total = 0;
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (s.durationSeconds != null && s.durationSeconds > 0) {
          total += s.durationSeconds;
        }
      }
    }
    return total;
  }, [session]);

  let message = 'Great workout!';
  if (session.prCount > 0 && session.totalSets >= 20) {
    message = 'Incredible session! New records smashed!';
  } else if (session.prCount > 0) {
    message = 'New personal records! Keep pushing!';
  } else if (session.totalSets >= 20) {
    message = 'Beast mode! Massive volume today!';
  } else if (session.durationSeconds >= 3600) {
    message = 'Solid grind! Over an hour of work!';
  }

  const prExercises = session.exercises.filter((e) =>
    e.sets.some((s) => s.isPR),
  );

  const moods = [
    { emoji: '\ud83d\ude24', key: 'tough' },
    { emoji: '\ud83d\ude0a', key: 'great' },
    { emoji: '\ud83d\ude10', key: 'okay' },
    { emoji: '\ud83d\ude34', key: 'tired' },
    { emoji: '\ud83d\udd25', key: 'fired_up' },
  ];

  // ── Previous session comparison ────────────────────────────────
  const previousSession = useMemo(() => {
    if (!session) return null;
    // Find the most recent completed session for the same program+day (or same name)
    const candidates = history.filter((s) => {
      if (s.id === session.id) return false;
      if (session.programId && session.dayId) {
        return s.programId === session.programId && s.dayId === session.dayId;
      }
      return s.name === session.name;
    });
    if (candidates.length === 0) return null;
    // Sort descending by completedAt and take the most recent
    candidates.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return candidates[0];
  }, [session, history]);

  const comparison = useMemo(() => {
    if (!session || !previousSession) return null;
    const volumeDiff = session.totalVolume - previousSession.totalVolume;
    const volumePct = previousSession.totalVolume > 0
      ? Math.round((volumeDiff / previousSession.totalVolume) * 100)
      : 0;
    const durationDiff = session.durationSeconds - previousSession.durationSeconds;
    const durationDiffMins = Math.abs(Math.round(durationDiff / 60));
    const setDiff = session.totalSets - previousSession.totalSets;
    return { volumeDiff, volumePct, durationDiff, durationDiffMins, setDiff };
  }, [session, previousSession]);

  // Build muscle highlights from workout exercises
  const muscleHighlights: MuscleHighlight[] = useMemo(() => {
    if (!session) return [];
    const seen = new Set<string>();
    const highlights: MuscleHighlight[] = [];
    for (const ex of session.exercises) {
      const libEntry = exercises.find((e) => e.id === ex.exerciseId);
      if (!libEntry) continue;
      const diagramData = getMuscleDiagramData(libEntry);
      for (const m of diagramData.primaryMuscles) {
        if (!seen.has(m.muscle)) {
          seen.add(m.muscle);
          highlights.push({ muscleId: m.muscle, state: 'targeted' });
        }
      }
      for (const m of diagramData.secondaryMuscles) {
        if (!seen.has(m.muscle)) {
          seen.add(m.muscle);
          highlights.push({ muscleId: m.muscle, state: 'targeted' });
        }
      }
    }
    return highlights;
  }, [session, exercises]);

  // Animated counter values
  const animVolume = useAnimatedCounter(session.totalVolume, countersActive);
  const animSets = useAnimatedCounter(session.totalSets, countersActive);
  const animExercises = useAnimatedCounter(exercisesDone, countersActive);
  const animCalories = useAnimatedCounter(displayCalories, countersActive);
  const animPRs = useAnimatedCounter(session.prCount, countersActive);
  const animDistance = useAnimatedCounter(
    totalDistance ? Math.round(totalDistance.value * 10) : 0,
    countersActive,
  );

  // ── Share handler ──────────────────────────────────────────────
  const handleShare = async () => {
    if (!session) return;
    const summary = `\ud83c\udfcb\ufe0f Workout Complete!\n${session.name}\n\u23f1 ${durationDisplay}\n\ud83d\udcaa ${exercisesDone} exercises \u00b7 ${session.totalSets} sets\n\ud83d\udcca ${session.totalVolume.toLocaleString()} ${weightUnit} total volume${
      session.prCount > 0 ? `\n\ud83c\udfc6 ${session.prCount} new PR${session.prCount > 1 ? 's' : ''}!` : ''
    }`;
    try {
      await Share.share({ message: summary });
    } catch (e) {
      console.error('[WorkoutSummary] Share failed:', e);
    }
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onDone} maxHeight={0.92}>
        {/* Confetti */}
        <ConfettiBurst visible={visible} />

        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Ionicons name="trophy" size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
          <Animated.Text
            style={[
              typography.h2,
              {
                color: colors.text,
                textAlign: 'center',
                marginBottom: spacing.xs,
                transform: [{ scale: headingScale }],
              },
            ]}
          >
            Workout Complete!
          </Animated.Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm }]}>
            {message}
          </Text>
          <Text style={[typography.label, { color: colors.primary, textAlign: 'center' }]}>
            {session.name}
          </Text>
        </View>

        {/* Muscles Worked */}
        {muscleHighlights.length > 0 && (
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={[typography.overline, { color: colors.primary, marginBottom: spacing.sm }]}>
              Muscles Worked
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.base }}>
              <MuscleAnatomyDiagram
                view="front"
                variant="mini"
                highlights={muscleHighlights}
                width={80}
                height={160}
              />
              <MuscleAnatomyDiagram
                view="back"
                variant="mini"
                highlights={muscleHighlights}
                width={80}
                height={160}
              />
            </View>
          </View>
        )}

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: spacing.lg }}>
          <StatCard label="Duration" value={durationDisplay} />
          <StatCard label="Volume" value={animVolume.toLocaleString()} unit={weightUnit} />
          <StatCard label="Sets" value={String(animSets)} />
          <StatCard label="Exercises" value={String(animExercises)} />
          <StatCard
            label={calorieLabel}
            value={countersActive
              ? (watchCalories ? `${animCalories}` : formatCalorieEstimate(calorieResult))
              : '0'}
            unit="cal"
          />
          {totalDistance && (
            <StatCard label="Distance" value={String(animDistance / 10)} unit={totalDistance.unit} />
          )}
          {activeTimeSecs > 0 && (
            <StatCard label="Active Time" value={formatDuration(activeTimeSecs)} />
          )}
          {session.prCount > 0 && (
            <StatCard label="PRs" value={String(animPRs)}>
              <Ionicons name="trophy" size={14} color={colors.primary} style={{ marginTop: 2 }} />
            </StatCard>
          )}
        </View>

        {/* PR details */}
        {prExercises.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.overline, { color: colors.primary, marginBottom: spacing.sm }]}>
              Personal Records
            </Text>
            {prExercises.map((ex) => (
              <View
                key={ex.exerciseId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.prBg,
                  borderWidth: 1,
                  borderColor: colors.borderBrand,
                  borderRadius: radius.lg,
                  padding: spacing.base,
                  marginBottom: spacing.xs,
                }}
              >
                <Ionicons name="trophy" size={16} color={colors.primary} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}>
                  {ex.exerciseName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {ex.sets
                    .filter((s) => s.isPR)
                    .map((s) => `${s.weight ?? 0}\u00d7${s.reps ?? 0}`)
                    .join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* vs. Last Time */}
        {comparison && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.overline, { color: colors.primary, marginBottom: spacing.sm }]}>
              vs. Last Time
            </Text>
            <View style={{
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: spacing.base,
              gap: spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Volume</Text>
                <Text style={[typography.label, { color: comparison.volumeDiff >= 0 ? colors.completed : colors.error }]}>
                  {comparison.volumeDiff >= 0 ? '+' : ''}{comparison.volumePct}%{' '}
                  ({comparison.volumeDiff >= 0 ? '+' : ''}{comparison.volumeDiff.toLocaleString()} {weightUnit})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Duration</Text>
                <Text style={[typography.label, { color: comparison.durationDiff <= 0 ? colors.completed : colors.error }]}>
                  {comparison.durationDiffMins > 0
                    ? `${comparison.durationDiffMins} min ${comparison.durationDiff <= 0 ? 'faster' : 'slower'}`
                    : 'Same'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Sets</Text>
                <Text style={[typography.label, { color: comparison.setDiff >= 0 ? colors.completed : colors.error }]}>
                  {comparison.setDiff >= 0 ? '+' : ''}{comparison.setDiff} sets
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Mood Emoji Picker */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.overline, { color: colors.primary, marginBottom: spacing.sm }]}>
            How did it feel?
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
            {moods.map((m) => {
              const isSelected = selectedMood === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setSelectedMood(m.key)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.full,
                    backgroundColor: isSelected ? colors.primaryMuted : colors.surfaceSecondary,
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? colors.borderBrand : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={m.key}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Feedback prompt */}
        {showPrompt && (
          <View style={{
            width: '100%',
            marginBottom: spacing.lg,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.lg,
            padding: spacing.base,
            alignItems: 'center',
          }}>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.sm, textAlign: 'center' }]}>
              How's FormIQ working for you?
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const StoreReview = await import('expo-store-review');
                    if (await StoreReview.hasAction()) {
                      await StoreReview.requestReview();
                    }
                  } catch (e) {
                    console.error('[WorkoutSummary] Store review failed:', e);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.completedMuted ?? colors.surface,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  gap: spacing.xs,
                }}
                accessibilityRole="button"
                accessibilityLabel="Love it - rate the app"
              >
                <Ionicons name="heart" size={18} color={colors.completed} />
                <Text style={[typography.label, { color: colors.completed }]}>Love it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFeedbackSheet(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.warningLight,
                  paddingHorizontal: spacing.base,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  gap: spacing.xs,
                }}
                accessibilityRole="button"
                accessibilityLabel="Could be better - send feedback"
              >
                <Ionicons name="chatbox-outline" size={18} color={colors.warning} />
                <Text style={[typography.label, { color: colors.warning }]}>Could be better</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ gap: spacing.md, width: '100%' }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Share"
              variant="secondary"
              onPress={handleShare}
              icon={<Ionicons name="share-outline" size={18} color={colors.primary} />}
              style={{ flex: 1 }}
            />
            <Button
              title="Done"
              onPress={onDone}
              style={{ flex: 1 }}
            />
          </View>
          <TouchableOpacity
            onPress={async () => {
              try {
                await postWorkoutCompletion({
                  title: `Completed ${session.name}`,
                  body: `${durationDisplay} \u00b7 ${exercisesDone} exercises \u00b7 ${session.totalSets} sets \u00b7 ${session.totalVolume.toLocaleString()} ${weightUnit}${session.prCount > 0 ? ` \u00b7 ${session.prCount} PR${session.prCount > 1 ? 's' : ''}` : ''}`,
                  metadata: {
                    durationSeconds: session.durationSeconds,
                    exerciseCount: exercisesDone,
                    totalSets: session.totalSets,
                    totalVolume: session.totalVolume,
                    prCount: session.prCount,
                  },
                  sessionId: session.id,
                });
                successNotification();
                setPostedToFeed(true);
              } catch {
                // Silently handle — non-critical
              }
            }}
            disabled={postedToFeed}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: postedToFeed ? colors.surfaceSecondary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Ionicons
              name={postedToFeed ? 'checkmark-circle' : 'people-outline'}
              size={18}
              color={postedToFeed ? colors.completed : colors.text}
            />
            <Text style={[typography.body, { color: postedToFeed ? colors.completed : colors.text, fontWeight: '600' }]}>
              {postedToFeed ? 'Posted!' : 'Post to Feed'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <FeedbackSheet
        visible={showFeedbackSheet}
        onClose={() => setShowFeedbackSheet(false)}
        screenContext={`Post-Workout Summary \u2014 ${session.name}, ${session.totalSets} sets, ${formatDuration(session.durationSeconds)}`}
      />
    </>
  );
}
