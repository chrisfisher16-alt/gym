import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  StyleSheet,
  Linking,
} from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme, typography, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { ExerciseImage } from './workout/ExerciseImage';
import { ExerciseImageViewer } from './workout/ExerciseImageViewer';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';
import type { MuscleHighlight } from './MuscleAnatomyDiagram';
import { useEntrance } from '../lib/animations';
import { getMuscleDiagramData } from '../lib/exercise-media';
import {
  CATEGORY_COLORS,
  CATEGORY_COLORS_DARK,
  EQUIPMENT_ILLUSTRATION_ICONS,
} from '../lib/exercise-illustrations';
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../lib/exercise-data';
import { useWorkoutStore } from '../stores/workout-store';
import { useProfileStore } from '../stores/profile-store';
import type {
  ExerciseLibraryEntry,
  CompletedSession,
  PersonalRecord,
} from '../types/workout';

// ── Types ────────────────────────────────────────────────────────────

export interface ExerciseDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  exercise: ExerciseLibraryEntry;
  showAddToWorkout?: boolean;
  onAddToWorkout?: (exerciseId: string) => void;
}

interface ExerciseHistorySession {
  date: string;
  bestSet: { weight: number; reps: number };
  totalVolume: number;
}

interface ExerciseHistoryData {
  sessions: ExerciseHistorySession[];
  pr: PersonalRecord | null;
  volumeProgression: number[]; // last 8-10 session volumes
}

// ── Helper: Extract Exercise History ─────────────────────────────────

function getExerciseHistory(
  exerciseId: string,
  history: CompletedSession[],
  personalRecords: Record<string, PersonalRecord>,
): ExerciseHistoryData {
  const matchingSessions: ExerciseHistorySession[] = [];

  // Scan history in reverse (most recent first)
  const sorted = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  for (const session of sorted) {
    const matchingExercise = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!matchingExercise) continue;

    let bestWeight = 0;
    let bestReps = 0;
    let totalVolume = 0;

    for (const set of matchingExercise.sets) {
      const w = set.weight ?? 0;
      const r = set.reps ?? 0;
      totalVolume += w * r;
      if (w > bestWeight || (w === bestWeight && r > bestReps)) {
        bestWeight = w;
        bestReps = r;
      }
    }

    matchingSessions.push({
      date: session.completedAt,
      bestSet: { weight: bestWeight, reps: bestReps },
      totalVolume,
    });
  }

  const volumeProgression = matchingSessions
    .slice(0, 10)
    .reverse()
    .map((s) => s.totalVolume);

  return {
    sessions: matchingSessions.slice(0, 3),
    pr: personalRecords[exerciseId] ?? null,
    volumeProgression,
  };
}

// ── Helper: Trend direction ──────────────────────────────────────────

function getTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';
  const first = values[0];
  const last = values[values.length - 1];
  const change = (last - first) / (first || 1);
  if (change > 0.05) return 'up';
  if (change < -0.05) return 'down';
  return 'stable';
}

// ── Helper: Format date ──────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Performance Sparkline ────────────────────────────────────────────

function PerformanceSparkline({
  values,
  width = 280,
  height = 60,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { colors } = useTheme();

  if (values.length < 2) return null;

  const trend = getTrend(values);
  const trendColor =
    trend === 'up' ? colors.success : trend === 'down' ? colors.error : colors.textTertiary;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * chartW;
      const y = padding + chartH - ((v - min) / range) * chartH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        <Line
          x1={padding}
          y1={padding + chartH}
          x2={padding + chartW}
          y2={padding + chartH}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Polyline
          points={points}
          fill="none"
          stroke={trendColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={[styles.sparklineLabel, { color: trendColor }]}>
        {trend === 'up' ? '↑ Improving' : trend === 'down' ? '↓ Declining' : '— Stable'}
      </Text>
    </View>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function ExerciseDetailSheet({
  visible,
  onClose,
  exercise,
  showAddToWorkout,
  onAddToWorkout,
}: ExerciseDetailSheetProps) {
  const { colors, dark, typography, spacing, radius } = useTheme();
  const history = useWorkoutStore((s) => s.history);
  const personalRecords = useWorkoutStore((s) => s.personalRecords);
  const unitPreference = useProfileStore((s) => s.profile?.unitPreference ?? 'imperial');
  const weightUnit = unitPreference === 'metric' ? 'kg' : 'lbs';

  // Staggered entrance animations
  const anim0 = useEntrance(0);
  const anim1 = useEntrance(80);
  const anim2 = useEntrance(160);
  const anim3 = useEntrance(240);
  const anim4 = useEntrance(320);
  const anim5 = useEntrance(400);
  const anim6 = useEntrance(480);

  // Derive data
  const diagramData = useMemo(() => getMuscleDiagramData(exercise), [exercise]);
  const historyData = useMemo(
    () => getExerciseHistory(exercise.id, history, personalRecords),
    [exercise.id, history, personalRecords],
  );

  const categoryColors = dark
    ? CATEGORY_COLORS_DARK[exercise.category]
    : CATEGORY_COLORS[exercise.category];

  // Build muscle highlights for anatomy diagrams
  const muscleHighlights: MuscleHighlight[] = useMemo(() => {
    const highlights: MuscleHighlight[] = [];
    for (const entry of diagramData.primaryMuscles) {
      highlights.push({ muscleId: entry.muscle, state: 'targeted', opacity: 1.0 });
    }
    for (const entry of diagramData.secondaryMuscles) {
      highlights.push({ muscleId: entry.muscle, state: 'targeted', opacity: 0.4 });
    }
    return highlights;
  }, [diagramData]);

  const equipmentIcon =
    EQUIPMENT_ILLUSTRATION_ICONS[exercise.equipment] ?? 'barbell-outline';

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={0.92} scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        style={{ marginHorizontal: -spacing.lg, marginTop: -spacing.lg }}
        contentContainerStyle={{ paddingBottom: showAddToWorkout ? 80 : spacing.xl }}
      >
        {/* ── 1. Hero Image ─────────────────────────────────── */}
        <Animated.View style={anim0.animatedStyle}>
          <View style={{ position: 'relative' }}>
            <ExerciseImageViewer
              exerciseId={exercise.id}
              size="detail"
              style={{ marginBottom: 16 }}
            />
            {/* Gradient overlay for readability */}
            <LinearGradient
              colors={['transparent', colors.barBlur]}
              style={[StyleSheet.absoluteFill, { top: '50%' }]}
              pointerEvents="none"
            />
            {/* How-To button overlay */}
            {exercise.videoUrl && (
              <Pressable
                onPress={() => Linking.openURL(exercise.videoUrl!)}
                style={[
                  styles.howToButton,
                  { backgroundColor: colors.overlay, borderRadius: radius.md },
                ]}
              >
                <Ionicons name="play-circle-outline" size={16} color={colors.textOnPrimary} />
                <Text style={[styles.howToText, { color: colors.textOnPrimary }]}>How-To</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* ── 2. Exercise Header ──────────────────────────── */}
          <Animated.View style={[anim1.animatedStyle, { marginTop: spacing.base }]}>
            <Text style={[typography.h2, { color: colors.text }]}>{exercise.name}</Text>
            <View style={[styles.badgeRow, { marginTop: spacing.sm }]}>
              {/* Category badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: categoryColors?.bg ?? colors.surfaceSecondary,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: categoryColors?.text ?? colors.textSecondary },
                  ]}
                >
                  {MUSCLE_GROUP_LABELS[exercise.category]}
                </Text>
              </View>
              {/* Equipment badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Ionicons
                  name={equipmentIcon as any}
                  size={12}
                  color={colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                  {EQUIPMENT_LABELS[exercise.equipment]}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── 3. Target Muscles Section ───────────────────── */}
          <Animated.View style={[anim2.animatedStyle, { marginTop: spacing.xl }]}>
            <Text style={[typography.overline, { color: colors.textTertiary, marginBottom: spacing.md }]}>
              Target Muscles
            </Text>
            <View style={styles.diagramRow}>
              <MuscleAnatomyDiagram
                view="front"
                variant="mini"
                highlights={muscleHighlights}
                width={120}
                height={160}
              />
              <MuscleAnatomyDiagram
                view="back"
                variant="mini"
                highlights={muscleHighlights}
                width={120}
                height={160}
              />
            </View>
            {/* Primary / Secondary Legend */}
            <View style={[styles.muscleLegendRow, { marginTop: spacing.md }]}>
              <View style={styles.muscleLegendItem}>
                <View style={[styles.muscleLegendSwatch, { backgroundColor: colors.primary, opacity: 1.0 }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Primary</Text>
              </View>
              <View style={styles.muscleLegendItem}>
                <View style={[styles.muscleLegendSwatch, { backgroundColor: colors.primary, opacity: 0.4 }]} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Secondary</Text>
              </View>
            </View>

            {/* Muscle labels */}
            <View style={{ marginTop: spacing.md }}>
              {exercise.primaryMuscles.length > 0 && (
                <View style={styles.muscleList}>
                  {exercise.primaryMuscles.map((m) => (
                    <Text
                      key={m}
                      style={[typography.body, { color: colors.text, fontWeight: '600' }]}
                    >
                      {m}
                    </Text>
                  ))}
                </View>
              )}
              {exercise.secondaryMuscles.length > 0 && (
                <View style={[styles.muscleList, { marginTop: spacing.xs }]}>
                  {exercise.secondaryMuscles.map((m) => (
                    <Text
                      key={m}
                      style={[typography.bodySmall, { color: colors.textSecondary, opacity: 0.6 }]}
                    >
                      {m}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── 4. Form Instructions ───────────────────────── */}
          {exercise.instructions.length > 0 && (
            <Animated.View style={[anim3.animatedStyle, { marginTop: spacing.xl }]}>
              <Text
                style={[typography.overline, { color: colors.textTertiary, marginBottom: spacing.md }]}
              >
                How to Perform
              </Text>
              {exercise.instructions.map((step, i) => (
                <View key={i} style={styles.instructionRow}>
                  <View
                    style={[
                      styles.stepNumber,
                      {
                        backgroundColor: colors.primaryMuted,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typography.labelSmall, { color: colors.primary }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.text, flex: 1, marginLeft: spacing.md },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}

              {/* Pro Tips */}
              {exercise.tips && exercise.tips.length > 0 && (
                <View
                  style={[
                    styles.tipsContainer,
                    {
                      backgroundColor: colors.primaryDim,
                      borderRadius: radius.lg,
                      borderLeftColor: colors.primary,
                      marginTop: spacing.base,
                    },
                  ]}
                >
                  <View style={styles.tipsHeader}>
                    <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                    <Text
                      style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}
                    >
                      Pro Tips
                    </Text>
                  </View>
                  {exercise.tips.map((tip, i) => (
                    <Text
                      key={i}
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: spacing.xs },
                      ]}
                    >
                      • {tip}
                    </Text>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          {/* ── 5. Watch Video Button ──────────────────────── */}
          {exercise.videoUrl && (
            <Animated.View style={[anim4.animatedStyle, { marginTop: spacing.xl }]}>
              <Pressable
                onPress={() => Linking.openURL(exercise.videoUrl!)}
                style={({ pressed }) => [
                  styles.videoButton,
                  {
                    backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary,
                    borderRadius: radius.lg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="play-circle" size={22} color={colors.primary} />
                <Text
                  style={[
                    typography.label,
                    { color: colors.primary, marginLeft: spacing.sm },
                  ]}
                >
                  Watch Video
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── 6. Your History Section ────────────────────── */}
          <Animated.View style={[anim5.animatedStyle, { marginTop: spacing.xl }]}>
            <Text
              style={[typography.overline, { color: colors.textTertiary, marginBottom: spacing.md }]}
            >
              Your History
            </Text>

            {/* Personal Record */}
            {historyData.pr?.heaviestWeight && (
              <View
                style={[
                  styles.prCard,
                  {
                    backgroundColor: colors.prBg,
                    borderRadius: radius.lg,
                    borderColor: colors.borderBrand,
                  },
                ]}
              >
                <Ionicons name="trophy" size={18} color={colors.gold} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.labelSmall, { color: colors.gold }]}>
                    Personal Record
                  </Text>
                  <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                    {historyData.pr.heaviestWeight.weight} {weightUnit} × {historyData.pr.heaviestWeight.reps}{' '}
                    reps
                  </Text>
                </View>
              </View>
            )}

            {/* Recent sessions */}
            {historyData.sessions.length > 0 ? (
              historyData.sessions.map((session, i) => (
                <View
                  key={i}
                  style={[
                    styles.historyRow,
                    {
                      borderBottomColor: colors.divider,
                      borderBottomWidth: i < historyData.sessions.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, width: 60 }]}>
                    {formatDate(session.date)}
                  </Text>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                    {session.bestSet.weight} {weightUnit} × {session.bestSet.reps} reps
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                    {session.totalVolume.toLocaleString()} vol
                  </Text>
                </View>
              ))
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg }]}>
                <Ionicons name="time-outline" size={24} color={colors.textTertiary} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' },
                  ]}
                >
                  You haven't performed this exercise yet
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ── 7. Performance Sparkline ────────────────────── */}
          {historyData.volumeProgression.length >= 2 && (
            <Animated.View style={[anim6.animatedStyle, { marginTop: spacing.lg }]}>
              <Text
                style={[
                  typography.overline,
                  { color: colors.textTertiary, marginBottom: spacing.sm },
                ]}
              >
                Volume Trend
              </Text>
              <PerformanceSparkline values={historyData.volumeProgression} />
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* ── 8. Add to Workout CTA ──────────────────────── */}
      {showAddToWorkout && (
        <View
          style={[
            styles.ctaContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={() => onAddToWorkout?.(exercise.id)}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: pressed ? colors.primaryDark : colors.primary,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.textInverse} />
            <Text
              style={[
                typography.labelLarge,
                { color: colors.textInverse, marginLeft: spacing.sm },
              ]}
            >
              Add to Workout
            </Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  howToButton: {
    position: 'absolute',
    bottom: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  howToText: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
  },
  muscleLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  muscleLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muscleLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  muscleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsContainer: {
    padding: spacing.base,
    borderLeftWidth: 3,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sparklineLabel: {
    ...typography.statUnit,
    marginTop: spacing.xs,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
});
