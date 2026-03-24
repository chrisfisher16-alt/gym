import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { MuscleAnatomyDiagram } from './MuscleAnatomyDiagram';
import { MUSCLE_GROUPS } from './MuscleGroupTile';
import { Card } from './ui/Card';
import { BottomSheet } from './ui/BottomSheet';
import { calculateMuscleGroupRecovery } from '../lib/recovery';
import type { MuscleHighlight, MuscleState } from './MuscleAnatomyDiagram';
import type { MuscleGroupInfo } from './MuscleGroupTile';
import type { CompletedSession } from '../types/workout';
import type { MuscleId } from '../types/workout';

// ── Public Props ─────────────────────────────────────────────────────

export interface RecoveryViewProps {
  history: CompletedSession[];
  style?: StyleProp<ViewStyle>;
}

// ── Recovery Helpers ─────────────────────────────────────────────────

function getRecoveryColor(
  percent: number,
  colors: { success: string; warning: string; error: string },
): string {
  if (percent >= 80) return colors.success;
  if (percent >= 40) return colors.warning;
  return colors.error;
}

function getRecoveryLabel(percent: number): string {
  if (percent >= 80) return 'Fresh';
  if (percent >= 40) return 'Recovering';
  return 'Fatigued';
}

function getRecoveryState(percent: number): MuscleState {
  if (percent >= 80) return 'fresh';
  if (percent >= 40) return 'recovering';
  return 'targeted'; // recovery colorMode renders 'targeted' as red (fatigued)
}

// ── Sorted Group Data ────────────────────────────────────────────────

interface GroupRecoveryRow {
  group: MuscleGroupInfo;
  percent: number;
  label: string;
}

function buildSortedRows(recoveryData: Record<string, number>): GroupRecoveryRow[] {
  return MUSCLE_GROUPS.map((g) => {
    const percent = recoveryData[g.id] ?? 100;
    return { group: g, percent, label: getRecoveryLabel(percent) };
  }).sort((a, b) => a.percent - b.percent); // fatigued first
}

// ── Highlight Builder ────────────────────────────────────────────────

function buildHighlights(recoveryData: Record<string, number>): MuscleHighlight[] {
  const highlights: MuscleHighlight[] = [];
  for (const group of MUSCLE_GROUPS) {
    const percent = recoveryData[group.id] ?? 100;
    const state = getRecoveryState(percent);
    for (const muscleId of group.muscleIds) {
      highlights.push({ muscleId, state });
    }
  }
  return highlights;
}

// ── Detail Sheet Helpers ─────────────────────────────────────────────

function findLastWorkoutForGroup(
  history: CompletedSession[],
  group: MuscleGroupInfo,
): { date: string; sets: number } | null {
  // Keyword heuristic mirroring recovery.ts
  const GROUP_KEYWORDS: Record<string, string[]> = {
    abs: ['ab', 'crunch', 'sit-up', 'situp', 'plank', 'hollow', 'leg raise', 'v-up', 'woodchop'],
    back: ['row', 'pull-up', 'pullup', 'chin-up', 'chinup', 'lat ', 'pulldown', 'deadlift', 'back'],
    biceps: ['curl', 'bicep', 'preacher', 'hammer'],
    chest: ['bench', 'chest', 'push-up', 'pushup', 'fly', 'flye', 'press', 'pec'],
    glutes: ['glute', 'hip thrust', 'bridge', 'squat', 'deadlift', 'lunge', 'kickback'],
    hamstrings: ['hamstring', 'leg curl', 'romanian', 'rdl', 'deadlift', 'good morning', 'nordic'],
    quadriceps: ['squat', 'leg press', 'leg extension', 'lunge', 'quad', 'front squat', 'hack'],
    shoulders: ['shoulder', 'press', 'lateral raise', 'delt', 'overhead', 'military', 'arnold'],
    triceps: ['tricep', 'pushdown', 'skull', 'dip', 'close grip', 'kickback', 'extension'],
    lower_back: ['back extension', 'hyperextension', 'good morning', 'deadlift', 'superman'],
    calves: ['calf', 'calves', 'calf raise', 'heel raise'],
    forearms: ['forearm', 'wrist curl', 'grip', 'farmer'],
    hip_flexors: ['hip flexor', 'psoas', 'leg raise', 'mountain climber', 'adductor', 'abductor'],
  };

  const keywords = GROUP_KEYWORDS[group.id];
  if (!keywords) return null;

  // Sessions are typically newest-first
  for (const session of history) {
    let matchedSets = 0;
    for (const exercise of session.exercises) {
      const name = exercise.exerciseName.toLowerCase();
      if (keywords.some((kw) => name.includes(kw))) {
        matchedSets += exercise.sets.length;
      }
    }
    if (matchedSets > 0) {
      return { date: session.completedAt, sets: matchedSets };
    }
  }
  return null;
}

function getRecommendation(percent: number): string {
  if (percent >= 80) return 'Ready to train';
  // Estimate remaining hours: rough inverse of the recovery curve
  const remaining = Math.round(((80 - percent) / 100) * 72);
  return `Rest ~${remaining} more hours`;
}

// ── Component ────────────────────────────────────────────────────────

export function RecoveryView({ history, style }: RecoveryViewProps) {
  const { colors, spacing, typography, radius } = useTheme();

  // ── State ──────────────────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // ── Recovery Data ──────────────────────────────────────────────────
  const recoveryData = useMemo(() => calculateMuscleGroupRecovery(history), [history]);
  const highlights = useMemo(() => buildHighlights(recoveryData), [recoveryData]);
  const rows = useMemo(() => buildSortedRows(recoveryData), [recoveryData]);

  // ── Header Stats ───────────────────────────────────────────────────
  const daysSinceLast = useMemo(() => {
    if (history.length === 0) return null;
    // Find most recent session
    let latest = new Date(history[0].completedAt).getTime();
    for (const s of history) {
      const ts = new Date(s.completedAt).getTime();
      if (ts > latest) latest = ts;
    }
    return Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
  }, [history]);

  const freshCount = useMemo(() => {
    return Object.values(recoveryData).filter((v) => v >= 80).length;
  }, [recoveryData]);

  // ── Muscle press → find group ──────────────────────────────────────
  const handleMusclePress = useCallback(
    (muscleId: MuscleId) => {
      const group = MUSCLE_GROUPS.find((g) => g.muscleIds.includes(muscleId));
      if (group) setSelectedGroupId(group.id);
    },
    [],
  );

  // ── Selected group detail data ─────────────────────────────────────
  const selectedGroup = useMemo(
    () => (selectedGroupId ? MUSCLE_GROUPS.find((g) => g.id === selectedGroupId) ?? null : null),
    [selectedGroupId],
  );
  const selectedPercent = selectedGroupId ? (recoveryData[selectedGroupId] ?? 100) : 100;
  const selectedLastWorkout = useMemo(
    () => (selectedGroup ? findLastWorkoutForGroup(history, selectedGroup) : null),
    [selectedGroup, history],
  );

  // ── No history guard ───────────────────────────────────────────────
  if (history.length === 0) return null;

  return (
    <View style={style}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.xs }]}>
          Recovery
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {daysSinceLast !== null && daysSinceLast >= 0
            ? `${daysSinceLast} day${daysSinceLast !== 1 ? 's' : ''} since your last workout`
            : 'No recent workouts'}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          {freshCount} fresh muscle group{freshCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Dual Anatomy Diagrams ──────────────────────────────── */}
      <Card style={{ marginBottom: spacing.md }}>
        <View style={s.diagramRow}>
          <View style={s.diagramCol}>
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.xs },
              ]}
            >
              Front
            </Text>
            <MuscleAnatomyDiagram
              view="front"
              highlights={highlights}
              variant="full"
              colorMode="recovery"
              interactive
              onMusclePress={handleMusclePress}
              height={200}
              pulseRecovering
            />
          </View>
          <View style={s.diagramCol}>
            <Text
              style={[
                typography.caption,
                { color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.xs },
              ]}
            >
              Back
            </Text>
            <MuscleAnatomyDiagram
              view="back"
              highlights={highlights}
              variant="full"
              colorMode="recovery"
              interactive
              onMusclePress={handleMusclePress}
              height={200}
              pulseRecovering
            />
          </View>
        </View>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <View style={[s.legendRow, { marginTop: spacing.sm }]}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.success }]} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Fresh</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.warning }]} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Recovering</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: colors.error }]} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Fatigued</Text>
          </View>
        </View>
      </Card>

      {/* ── Muscle Status List ─────────────────────────────────── */}
      <Card>
        <Text
          style={[
            typography.label,
            { color: colors.text, marginBottom: spacing.sm },
          ]}
        >
          Muscle Status
        </Text>

        {rows.map((row, i) => {
          const dotColor = getRecoveryColor(row.percent, colors);
          return (
            <View
              key={row.group.id}
              style={[
                s.statusRow,
                {
                  paddingVertical: spacing.sm,
                  borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View style={[s.statusDot, { backgroundColor: dotColor }]} />
              <Text
                style={[typography.body, { color: colors.text, flex: 1 }]}
              >
                {row.group.label}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: dotColor },
                ]}
              >
                {row.label} ({row.percent}%)
              </Text>
            </View>
          );
        })}
      </Card>

      {/* ── Muscle Detail Bottom Sheet ─────────────────────────── */}
      <BottomSheet
        visible={selectedGroupId !== null}
        onClose={() => setSelectedGroupId(null)}
        maxHeight={0.45}
      >
        {selectedGroup && (
          <View>
            <Text
              style={[
                typography.h3,
                { color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
              ]}
            >
              {selectedGroup.label}
            </Text>

            {/* Recovery % + visual bar */}
            <View style={{ marginBottom: spacing.md }}>
              <View style={s.barLabelRow}>
                <Text style={[typography.body, { color: colors.text }]}>Recovery</Text>
                <Text
                  style={[
                    typography.body,
                    { color: getRecoveryColor(selectedPercent, colors), fontWeight: '600' },
                  ]}
                >
                  {selectedPercent}%
                </Text>
              </View>
              <View
                style={[
                  s.barBg,
                  { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm },
                ]}
              >
                <View
                  style={[
                    s.barFill,
                    {
                      width: `${selectedPercent}%`,
                      backgroundColor: getRecoveryColor(selectedPercent, colors),
                      borderRadius: radius.sm,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Last workout */}
            <View style={[s.detailRow, { marginBottom: spacing.sm }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text
                style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}
              >
                {selectedLastWorkout
                  ? `Last worked: ${new Date(selectedLastWorkout.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'No recent sessions'}
              </Text>
            </View>

            {/* Sets in last session */}
            {selectedLastWorkout && (
              <View style={[s.detailRow, { marginBottom: spacing.sm }]}>
                <Ionicons name="barbell-outline" size={18} color={colors.textSecondary} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginLeft: spacing.sm },
                  ]}
                >
                  {selectedLastWorkout.sets} set{selectedLastWorkout.sets !== 1 ? 's' : ''} in last
                  session
                </Text>
              </View>
            )}

            {/* Recommendation */}
            <View
              style={[
                s.recommendationBox,
                {
                  backgroundColor:
                    selectedPercent >= 80 ? colors.successLight : colors.warningLight,
                  borderRadius: radius.md,
                  marginTop: spacing.sm,
                  padding: spacing.base,
                },
              ]}
            >
              <Ionicons
                name={selectedPercent >= 80 ? 'checkmark-circle' : 'time-outline'}
                size={20}
                color={selectedPercent >= 80 ? colors.success : colors.warning}
              />
              <Text
                style={[
                  typography.body,
                  {
                    color: selectedPercent >= 80 ? colors.success : colors.warning,
                    marginLeft: spacing.sm,
                    fontWeight: '600',
                  },
                ]}
              >
                {getRecommendation(selectedPercent)}
              </Text>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  diagramRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  diagramCol: {
    flex: 1,
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barBg: {
    height: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
