import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useWorkoutHistory } from '../../src/hooks/useWorkoutHistory';
import { Card, Badge } from '../../src/components/ui';
import { formatSessionDate, formatDuration, formatVolume, formatTime } from '../../src/lib/workout-utils';
import type { CompletedSession } from '../../src/types/workout';

type ViewMode = 'list' | 'calendar';

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { history, historyByDate } = useWorkoutHistory();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const renderSession = ({ item }: { item: CompletedSession }): React.ReactElement => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/workout/session/${item.id}`)}
    >
      <Card style={{ marginBottom: spacing.md }}>
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.label, { color: colors.text }]}>{item.name}</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {formatSessionDate(item.completedAt)} · {formatTime(item.completedAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>

        <View style={[styles.statsRow, { marginTop: spacing.md }]}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
              {formatDuration(item.durationSeconds)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="barbell-outline" size={14} color={colors.textTertiary} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
              {item.totalSets} sets
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="trending-up-outline" size={14} color={colors.textTertiary} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 4 }]}>
              {formatVolume(item.totalVolume)} lbs
            </Text>
          </View>
          {item.prCount > 0 && (
            <View style={styles.stat}>
              <Ionicons name="trophy" size={14} color={colors.warning} />
              <Text style={[typography.bodySmall, { color: colors.warning, marginLeft: 4 }]}>
                {item.prCount} PR{item.prCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  // Calendar view - simple day grid
  const renderCalendarView = () => {
    const dates = Array.from(historyByDate.keys()).sort().reverse();
    return (
      <FlatList
        data={dates}
        keyExtractor={(item: string) => item}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        renderItem={({ item: date }: { item: string }) => {
          const sessions = historyByDate.get(date) ?? [];
          return (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                {new Date(date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              {sessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/workout/session/${session.id}`)}
                >
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={styles.calendarSessionRow}>
                      <Text style={[typography.label, { color: colors.text, flex: 1 }]}>{session.name}</Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        {formatDuration(session.durationSeconds)} · {session.totalSets} sets
                      </Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>History</Text>

        <View style={styles.viewToggle}>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: viewMode === 'list' ? colors.primary : colors.surfaceSecondary,
                borderTopLeftRadius: radius.md,
                borderBottomLeftRadius: radius.md,
              },
            ]}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === 'list' ? colors.textInverse : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('calendar')}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: viewMode === 'calendar' ? colors.primary : colors.surfaceSecondary,
                borderTopRightRadius: radius.md,
                borderBottomRightRadius: radius.md,
              },
            ]}
          >
            <Ionicons
              name="calendar"
              size={18}
              color={viewMode === 'calendar' ? colors.textInverse : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={history}
          renderItem={renderSession}
          keyExtractor={(item: CompletedSession) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.base }]}>No History</Text>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
                Your completed workouts will appear here
              </Text>
            </View>
          }
        />
      ) : (
        renderCalendarView()
      )}
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
  viewToggle: {
    flexDirection: 'row',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
});
