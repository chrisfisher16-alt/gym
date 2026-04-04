import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ExpandableCard } from './ExpandableCard';
import { EmptyState } from './EmptyState';
import {
  aggregateTimeline,
  type TimelineEntry,
  type TimelineEntryType,
} from '../../lib/timeline-aggregator';
import { getDateString } from '../../lib/nutrition-utils';

// ── Types ──────────────────────────────────────────────────────────

export interface TimelineViewProps {
  date: string;                       // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return getDateString(d);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  }
  return `${m}m`;
}

// ── Expanded Detail Renderers ──────────────────────────────────────

interface DetailProps {
  entry: TimelineEntry;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}

function WorkoutCompletedDetail({ entry, colors, typography: typ, spacing }: DetailProps) {
  const d = entry.details as Record<string, unknown> | undefined;
  if (!d) return null;

  const exercises = d.exercises as Array<{
    exerciseName: string;
    sets: Array<{ weight?: number; reps?: number; isPR: boolean }>;
  }> | undefined;
  const dur = d.durationSeconds as number | undefined;
  const notes = d.notes as string | undefined;

  return (
    <View style={{ gap: spacing.sm }}>
      {dur != null && (
        <Text style={[typ.bodySmall, { color: colors.textSecondary }]}>
          Duration: {formatDuration(dur)}
        </Text>
      )}
      {exercises?.map((ex, i) => {
        const topSet = ex.sets.reduce<{ weight?: number; reps?: number } | null>(
          (best, s) => {
            if (!best) return s;
            return (s.weight ?? 0) > (best.weight ?? 0) ? s : best;
          },
          null,
        );
        const hasPR = ex.sets.some((s) => s.isPR);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={[typ.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {ex.exerciseName}
            </Text>
            <Text style={[typ.bodySmall, { color: colors.textSecondary }]}>
              {ex.sets.length} sets
              {topSet?.weight ? ` · ${topSet.weight} lbs` : ''}
            </Text>
            {hasPR && (
              <Ionicons name="trophy" size={12} color={colors.gold} />
            )}
          </View>
        );
      })}
      {notes ? (
        <Text style={[typ.bodySmall, { color: colors.textTertiary, fontStyle: 'italic' }]}>
          {notes}
        </Text>
      ) : null}
    </View>
  );
}

function MealDetail({ entry, colors, typography: typ, spacing }: DetailProps) {
  const d = entry.details as Record<string, unknown> | undefined;
  if (!d) return null;

  const items = d.items as Array<{
    name: string;
    calories: number;
    protein_g: number;
  }> | undefined;
  const totalCal = d.totalCalories as number | undefined;
  const totalPro = d.totalProtein as number | undefined;
  const totalCarb = d.totalCarbs as number | undefined;
  const totalFat = d.totalFat as number | undefined;

  return (
    <View style={{ gap: spacing.sm }}>
      {items?.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typ.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[typ.bodySmall, { color: colors.textSecondary }]}>
            {Math.round(item.calories)} cal
          </Text>
        </View>
      ))}
      {totalCal != null && (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <Text style={[typ.labelSmall, { color: colors.calories }]}>{Math.round(totalCal)} cal</Text>
          <Text style={[typ.labelSmall, { color: colors.protein }]}>{Math.round(totalPro ?? 0)}g P</Text>
          <Text style={[typ.labelSmall, { color: colors.carbs }]}>{Math.round(totalCarb ?? 0)}g C</Text>
          <Text style={[typ.labelSmall, { color: colors.fat }]}>{Math.round(totalFat ?? 0)}g F</Text>
        </View>
      )}
    </View>
  );
}

function PRDetail({ entry, colors, typography: typ, spacing }: DetailProps) {
  const d = entry.details as Record<string, unknown> | undefined;
  if (!d) return null;

  const weight = d.weight as number | undefined;
  const reps = d.reps as number | undefined;

  return (
    <View style={{ gap: spacing.xs }}>
      {weight != null && (
        <Text style={[typ.body, { color: colors.text }]}>Weight: {weight} lbs</Text>
      )}
      {reps != null && (
        <Text style={[typ.body, { color: colors.text }]}>Reps: {reps}</Text>
      )}
    </View>
  );
}

function MeasurementDetail({ entry, colors, typography: typ, spacing }: DetailProps) {
  const d = entry.details as Record<string, unknown> | undefined;
  if (!d) return null;

  const rows: Array<[string, string]> = [];
  if (d.weightKg != null) rows.push(['Weight', `${Math.round((d.weightKg as number) * 2.20462 * 10) / 10} lbs`]);
  if (d.chestCm != null) rows.push(['Chest', `${d.chestCm} cm`]);
  if (d.waistCm != null) rows.push(['Waist', `${d.waistCm} cm`]);
  if (d.hipsCm != null) rows.push(['Hips', `${d.hipsCm} cm`]);
  if (d.source) rows.push(['Source', d.source === 'health_sync' ? 'Apple Health' : 'Manual']);

  return (
    <View style={{ gap: spacing.xs }}>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typ.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[typ.body, { color: colors.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function GenericDetail({ entry, colors, typography: typ }: DetailProps) {
  if (!entry.subtitle) return null;
  return <Text style={[typ.body, { color: colors.text }]}>{entry.subtitle}</Text>;
}

// Renderer lookup by type
const DETAIL_RENDERERS: Record<TimelineEntryType, React.FC<DetailProps>> = {
  workout_completed: WorkoutCompletedDetail,
  workout_started: GenericDetail,
  meal_logged: MealDetail,
  water_logged: GenericDetail,
  supplement_taken: GenericDetail,
  weight_logged: MeasurementDetail,
  pr_achieved: PRDetail,
  achievement_earned: GenericDetail,
};

// ── TimelineEntry Row ──────────────────────────────────────────────

interface EntryRowProps {
  entry: TimelineEntry;
  isLast: boolean;
}

function TimelineEntryRow({ entry, isLast }: EntryRowProps) {
  const { colors, typography: typ, spacing, radius } = useTheme();
  const DetailComponent = DETAIL_RENDERERS[entry.type];
  const hasExpandableDetail = entry.type === 'workout_completed'
    || entry.type === 'meal_logged'
    || entry.type === 'weight_logged'
    || entry.type === 'pr_achieved';

  const collapsedContent = (
    <View style={S.entryRow}>
      {/* Time column */}
      <View style={S.timeCol}>
        <Text style={[typ.labelSmall, { color: colors.textTertiary }]}>
          {formatTime(entry.timestamp)}
        </Text>
      </View>

      {/* Timeline connector */}
      <View style={S.connectorCol}>
        <View style={[S.dot, { backgroundColor: entry.iconColor }]}>
          <Ionicons name={entry.icon} size={14} color="#FFFFFF" />
        </View>
        {!isLast && (
          <View style={[S.line, { backgroundColor: colors.borderLight }]} />
        )}
      </View>

      {/* Content */}
      <View style={S.contentCol}>
        <Text style={[typ.label, { color: colors.text }]} numberOfLines={1}>
          {entry.title}
        </Text>
        {entry.subtitle ? (
          <Text style={[typ.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={2}>
            {entry.subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!hasExpandableDetail) {
    return (
      <View style={{ paddingHorizontal: spacing.base }}>
        {collapsedContent}
      </View>
    );
  }

  return (
    <ExpandableCard
      style={{ marginHorizontal: spacing.base, borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 }}
      expandedContent={
        <View style={{ paddingLeft: 64 + spacing.sm }}>
          <DetailComponent
            entry={entry}
            colors={colors}
            typography={typ}
            spacing={spacing}
          />
        </View>
      }
    >
      {collapsedContent}
    </ExpandableCard>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function TimelineView({ date, onDateChange }: TimelineViewProps) {
  const { colors, typography: typ, spacing, radius } = useTheme();

  const entries = useMemo(() => aggregateTimeline(date), [date]);
  const isToday = date === getDateString();

  const goBack = useCallback(() => onDateChange(shiftDate(date, -1)), [date, onDateChange]);
  const goForward = useCallback(() => {
    if (!isToday) onDateChange(shiftDate(date, 1));
  }, [date, isToday, onDateChange]);

  return (
    <View style={{ flex: 1 }}>
      {/* Date Navigator */}
      <View style={[S.dateNav, { borderBottomColor: colors.borderLight, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[typ.label, { color: colors.text }]}>
            {formatDateHeader(date)}
          </Text>
          {isToday && (
            <Text style={[typ.caption, { color: colors.primary }]}>Today</Text>
          )}
        </View>

        <TouchableOpacity onPress={goForward} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={isToday}>
          <Ionicons name="chevron-forward" size={22} color={isToday ? colors.disabled : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Timeline Feed */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.base }}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No activity yet"
            description={isToday ? 'Start your day — log a workout, meal, or supplement.' : 'Nothing logged on this day.'}
          />
        ) : (
          <>
            {entries.map((entry, idx) => (
              <TimelineEntryRow
                key={entry.id}
                entry={entry}
                isLast={idx === entries.length - 1}
              />
            ))}

            {/* End-of-feed marker */}
            <View style={[S.endMarker, { marginTop: spacing.lg }]}>
              <View style={[S.endLine, { backgroundColor: colors.borderLight }]} />
              <Text style={[typ.caption, { color: colors.textTertiary, marginHorizontal: spacing.md }]}>
                No more entries
              </Text>
              <View style={[S.endLine, { backgroundColor: colors.borderLight }]} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const S = StyleSheet.create({
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
    paddingVertical: 8,
  },
  timeCol: {
    width: 64,
    alignItems: 'flex-end',
    paddingRight: 8,
    paddingTop: 2,
  },
  connectorCol: {
    width: 32,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginTop: 4,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 8,
    paddingTop: 2,
  },
  endMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  endLine: {
    flex: 1,
    height: 1,
  },
});
