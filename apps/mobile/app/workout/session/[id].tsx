import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutHistory } from '../../../src/hooks/useWorkoutHistory';
import { Card, Badge } from '../../../src/components/ui';
import { formatFullDate, formatTime, formatDuration, formatVolume, formatWeight } from '../../../src/lib/workout-utils';
import { useProfileStore } from '../../../src/stores/profile-store';

const MOOD_LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great'];
const MOOD_ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'ellipse-outline',
  'sad-outline',
  'sad-outline',
  'remove-outline',
  'happy-outline',
  'happy-outline',
];

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { getSessionById } = useWorkoutHistory();

  const session = getSessionById(id ?? '');
  const unitPref = useProfileStore((s) => s.profile.unitPreference);
  const unit = unitPref === 'metric' ? 'kg' : 'lbs';

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Session not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
          {session.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <Card style={{ marginBottom: spacing.base }}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {formatFullDate(session.completedAt)} · {formatTime(session.startedAt)}
          </Text>

          <View style={[styles.summaryGrid, { marginTop: spacing.md }]}>
            <View style={styles.summaryItem}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: 4 }]}>
                {formatDuration(session.durationSeconds)}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Duration</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="barbell-outline" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: 4 }]}>
                {session.totalSets}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Sets</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: 4 }]}>
                {formatVolume(session.totalVolume)}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Volume ({unit})</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="trophy" size={20} color={session.prCount > 0 ? colors.warning : colors.textTertiary} />
              <Text style={[typography.labelLarge, { color: session.prCount > 0 ? colors.warning : colors.text, marginTop: 4 }]}>
                {session.prCount}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>PRs</Text>
            </View>
          </View>

          {session.mood && (
            <View style={[styles.moodRow, { marginTop: spacing.md }]}>
              <Ionicons name={MOOD_ICONS[session.mood]} size={18} color={colors.primary} />
              <Text style={[typography.body, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                Feeling: {MOOD_LABELS[session.mood]}
              </Text>
            </View>
          )}
        </Card>

        {/* Exercises */}
        {session.exercises.map((exercise, index) => (
          <Card key={`${exercise.exerciseId}-${index}`} style={{ marginBottom: spacing.md }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              {exercise.exerciseName}
            </Text>

            {/* Set header */}
            <View style={[styles.setHeaderRow, { marginBottom: spacing.xs }]}>
              <Text style={[typography.caption, { color: colors.textTertiary, width: 30 }]}>SET</Text>
              <Text style={[typography.caption, { color: colors.textTertiary, flex: 1 }]}>WEIGHT</Text>
              <Text style={[typography.caption, { color: colors.textTertiary, flex: 1 }]}>REPS</Text>
              <Text style={[typography.caption, { color: colors.textTertiary, width: 40, textAlign: 'center' }]}>RPE</Text>
            </View>

            {exercise.sets.map((set, i) => (
              <View
                key={set.id}
                style={[
                  styles.setDetailRow,
                  {
                    backgroundColor: set.isPR ? colors.warningLight : 'transparent',
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: colors.textSecondary, width: 30 }]}>
                  {set.setType === 'warmup' ? 'W' : set.setNumber}
                </Text>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                  {set.weight ? formatWeight(set.weight, unit) : '—'}
                </Text>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                  {set.reps ?? '—'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, width: 40, textAlign: 'center' }]}>
                  {set.rpe ?? '—'}
                </Text>
                {set.isPR && (
                  <Ionicons name="trophy" size={14} color={colors.warning} style={{ marginLeft: 4 }} />
                )}
              </View>
            ))}
          </Card>
        ))}

        {/* Notes */}
        {session.notes ? (
          <Card style={{ marginBottom: spacing.base }}>
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs }]}>Notes</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{session.notes}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
});
