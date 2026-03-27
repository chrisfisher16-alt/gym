import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { Card, Badge, Button, Pill } from '../../../src/components/ui';
import type { WorkoutProgramLocal, DayType } from '../../../src/types/workout';
import { DAY_TYPE_COLORS, DAY_TYPE_ICONS } from '../../../src/types/workout';
import { selectionFeedback } from '../../../src/lib/haptics';

type Difficulty = WorkoutProgramLocal['difficulty'];

const DAYS_OPTIONS = [3, 4, 5, 6, 7] as const;
const DIFFICULTY_OPTIONS: { value: Difficulty | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export default function ProgramsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { activeProgram, inactivePrograms, programs } = useWorkoutPrograms();

  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');

  const toggleDays = useCallback((days: number) => {
    selectionFeedback();
    setSelectedDays((prev) => (prev === days ? null : days));
  }, []);

  const selectDifficulty = useCallback((value: Difficulty | 'all') => {
    selectionFeedback();
    setSelectedDifficulty(value);
  }, []);

  const hasActiveFilters = selectedDays !== null || selectedDifficulty !== 'all';

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      if (selectedDays !== null && p.daysPerWeek !== selectedDays) return false;
      if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [programs, selectedDays, selectedDifficulty]);

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
              {isActive && <Badge label="Active" variant="active" />}
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
        data={filteredPrograms}
        renderItem={({ item }: { item: WorkoutProgramLocal }) => renderProgram(item, item.isActive)}
        keyExtractor={(item: WorkoutProgramLocal) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            {/* Days per week filter */}
            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
              Days per week
            </Text>
            <View style={styles.pillRow}>
              {DAYS_OPTIONS.map((d) => (
                <Pill
                  key={d}
                  label={`${d} days`}
                  active={selectedDays === d}
                  onPress={() => toggleDays(d)}
                />
              ))}
            </View>

            {/* Difficulty filter */}
            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginTop: spacing.md, marginBottom: spacing.sm }]}>
              Level
            </Text>
            <View style={[styles.segContainer, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }]}>
              {DIFFICULTY_OPTIONS.map((opt) => {
                const isActive = opt.value === selectedDifficulty;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => selectDifficulty(opt.value)}
                    activeOpacity={0.7}
                    style={[
                      styles.segOption,
                      {
                        backgroundColor: isActive ? colors.surface : 'transparent',
                        borderRadius: radius.md - 2,
                        paddingVertical: spacing.sm,
                        borderWidth: isActive ? 1 : 0,
                        borderColor: isActive ? colors.borderBrand : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[typography.label, { color: isActive ? colors.text : colors.textTertiary, fontSize: 13 }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Result count */}
            <Text style={[typography.labelSmall, { color: colors.textTertiary, marginTop: spacing.md }]}>
              {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name={hasActiveFilters ? 'filter-outline' : 'barbell-outline'} size={48} color={colors.textTertiary} />
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.base }]}>
              {hasActiveFilters ? 'No Matches' : 'No Programs'}
            </Text>
            <Text
              style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}
            >
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Create a workout program to get started'}
            </Text>
            {!hasActiveFilters && (
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  title="Create Program"
                  onPress={() => router.push('/workout/programs/create')}
                  size="md"
                  fullWidth={false}
                />
              </View>
            )}
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
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segContainer: {
    flexDirection: 'row',
  },
  segOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
