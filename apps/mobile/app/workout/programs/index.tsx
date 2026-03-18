import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { Card, Badge, Button } from '../../../src/components/ui';
import type { WorkoutProgramLocal, DayType } from '../../../src/types/workout';
import { DAY_TYPE_COLORS, DAY_TYPE_ICONS } from '../../../src/types/workout';

export default function ProgramsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { activeProgram, inactivePrograms, programs } = useWorkoutPrograms();

  const getDayTypeBreakdown = (program: WorkoutProgramLocal) => {
    const counts: Partial<Record<DayType, number>> = {};
    for (const day of program.days) {
      counts[day.dayType] = (counts[day.dayType] || 0) + 1;
    }
    return Object.entries(counts) as [DayType, number][];
  };

  const formatDayType = (type: DayType): string => {
    return type === 'active_recovery' ? 'recovery' : type;
  };

  const renderProgram = (program: WorkoutProgramLocal, isActive: boolean) => (
    <TouchableOpacity
      key={program.id}
      activeOpacity={0.7}
      onPress={() => router.push(`/workout/programs/${program.id}`)}
    >
      <Card
        style={[
          { marginBottom: spacing.md },
          isActive && { borderColor: colors.primary, borderWidth: 2 },
        ]}
      >
        <View style={styles.programHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[typography.labelLarge, { color: colors.text }]}>{program.name}</Text>
              {isActive && <Badge label="Active" variant="success" />}
              {program.createdBy === 'ai' && <Badge label="AI" variant="pro" />}
            </View>
            {program.description ? (
              <Text
                style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}
                numberOfLines={2}
              >
                {program.description}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>

        <View style={[styles.statsRow, { marginTop: spacing.md }]}>
          <View style={styles.stat}>
            <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>Days</Text>
            <Text style={[typography.label, { color: colors.text }]}>{program.daysPerWeek}/week</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>Level</Text>
            <Text style={[typography.label, { color: colors.text, textTransform: 'capitalize' }]}>
              {program.difficulty}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[typography.labelSmall, { color: colors.textTertiary }]}>Schedule</Text>
            <View style={styles.dotsRow}>
              {program.days.map((day, i) => (
                <Ionicons
                  key={i}
                  name={DAY_TYPE_ICONS[day.dayType] as any}
                  size={14}
                  color={DAY_TYPE_COLORS[day.dayType]}
                />
              ))}
            </View>
          </View>
        </View>

        {program.days.length > 0 && (
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {getDayTypeBreakdown(program)
              .map(([type, count]) => `${count} ${formatDayType(type)}`)
              .join(' · ')}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>Programs</Text>
        <TouchableOpacity onPress={() => router.push('/workout/programs/create')}>
          <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={programs}
        renderItem={({ item }: { item: WorkoutProgramLocal }) => renderProgram(item, item.isActive)}
        keyExtractor={(item: WorkoutProgramLocal) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          activeProgram ? (
            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
              {programs.length} program{programs.length !== 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={48} color={colors.textTertiary} />
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.base }]}>No Programs</Text>
            <Text
              style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}
            >
              Create a workout program to get started
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <Button
                title="Create Program"
                onPress={() => router.push('/workout/programs/create')}
                size="md"
                fullWidth={false}
              />
            </View>
          </View>
        }
      />
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
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
});
