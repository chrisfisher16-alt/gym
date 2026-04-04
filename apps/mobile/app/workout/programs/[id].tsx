import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { crossPlatformAlert } from '../../../src/lib/cross-platform-alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { useActiveWorkout } from '../../../src/hooks/useActiveWorkout';
import { Card, Badge, Button } from '../../../src/components/ui';
import { useEntitlement } from '../../../src/hooks/useEntitlement';
import { usePaywall } from '../../../src/hooks/usePaywall';
import { checkWorkoutLogLimit, incrementUsage } from '../../../src/lib/usage-limits';
import { WorkoutSummaryModal } from '../../../src/components/workout/WorkoutSummaryModal';
import { successNotification } from '../../../src/lib/haptics';
import {
  DayType,
  DAY_TYPE_LABELS,
  DAY_TYPE_COLORS,
  DAY_TYPE_ICONS,
  CardioSuggestion,
  CompletedSession,
  WorkoutDayLocal,
  ProgramExercise,
} from '../../../src/types/workout';

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { programs, setActiveProgram, deleteProgram } = useWorkoutPrograms();
  const { startWorkout, isActive, completeWorkout, cancelWorkout } = useActiveWorkout();
  const [completedSession, setCompletedSession] = useState<CompletedSession | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [pendingDayIndex, setPendingDayIndex] = useState<number | null>(null);
  const { canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();

  const program = programs.find((p) => p.id === id);

  if (!program) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Program not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const launchDay = (dayIndex: number) => {
    const day = program.days[dayIndex];

    const doStart = () => {
      // Always set this program as active when starting one of its workouts
      if (!program.isActive) {
        setActiveProgram(program.id);
      }
      startWorkout({
        name: `${program.name} — ${day.name}`,
        programId: program.id,
        dayId: day.id,
        exercises: day.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exerciseName,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          restSeconds: e.restSeconds,
          supersetGroupId: e.supersetGroupId,
        })),
      });
      router.push('/workout/active');
    };

    if (canAccess('unlimited_workouts')) {
      doStart();
      return;
    }
    // Free tier — check usage
    checkWorkoutLogLimit().then((usage) => {
      if (usage.allowed) {
        incrementUsage('workout_logs');
        doStart();
      } else {
        crossPlatformAlert(
          'Workout Limit Reached',
          `You've used all ${usage.limit} free workouts this month. Upgrade to Workout Coach for unlimited workouts.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_workouts', source: 'program_detail' }) },
          ],
        );
      }
    });
  };

  const handleStartDay = (dayIndex: number) => {
    if (isActive) {
      crossPlatformAlert('Workout in Progress', 'You have an active workout. What would you like to do?', [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Discard & Start New',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            launchDay(dayIndex);
          },
        },
        {
          text: 'Finish & Start New',
          onPress: async () => {
            const result = await completeWorkout();
            if (result) {
              successNotification();
              setCompletedSession(result);
              setShowSummary(true);
              setPendingDayIndex(dayIndex);
            } else {
              // No completed sets — discard instead
              cancelWorkout();
              launchDay(dayIndex);
            }
          },
        },
      ]);
      return;
    }
    launchDay(dayIndex);
  };

  const handleSummaryDone = () => {
    setShowSummary(false);
    setCompletedSession(null);
    if (pendingDayIndex !== null) {
      launchDay(pendingDayIndex);
      setPendingDayIndex(null);
    }
  };

  const handleDelete = () => {
    crossPlatformAlert('Delete Program', `Are you sure you want to delete "${program.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProgram(program.id);
          router.back();
        },
      },
    ]);
  };

  const renderExerciseList = (exercises: ProgramExercise[], accentColor: string) => (
    <>
      {exercises.map((exercise, exIndex) => (
        <View
          key={exercise.id}
          style={[
            styles.exerciseRow,
            {
              paddingVertical: spacing.sm,
              borderTopWidth: exIndex === 0 ? 1 : 0,
              borderBottomWidth: 1,
              borderColor: colors.borderLight,
              marginTop: exIndex === 0 ? spacing.md : 0,
            },
          ]}
        >
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
            {exercise.exerciseName}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {exercise.targetSets} × {exercise.targetReps}
          </Text>
        </View>
      ))}
    </>
  );

  const renderCardioSuggestions = (suggestions: CardioSuggestion[]) => (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {suggestions.map((suggestion, idx) => (
        <View
          key={idx}
          style={[
            styles.cardioSubCard,
            {
              backgroundColor: colors.surfaceSecondary ?? colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              borderLeftWidth: 3,
              borderLeftColor: DAY_TYPE_COLORS.cardio,
            },
          ]}
        >
          <View style={styles.cardioSubCardHeader}>
            <Ionicons
              name={suggestion.icon as any}
              size={20}
              color={DAY_TYPE_COLORS.cardio}
            />
            <Text
              style={[
                typography.labelLarge,
                { color: colors.text, marginLeft: spacing.sm, flex: 1 },
              ]}
            >
              {suggestion.name}
            </Text>
            <Text style={[typography.labelSmall, { color: DAY_TYPE_COLORS.cardio }]}>
              {suggestion.duration}
            </Text>
          </View>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: 4 },
            ]}
          >
            {suggestion.description}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderDayTypeBadge = (day: WorkoutDayLocal) => {
    const accent = DAY_TYPE_COLORS[day.dayType];
    return (
      <View
        style={[
          styles.dayTypeBadge,
          {
            backgroundColor: accent + '1A', // 10% opacity
            borderRadius: radius.sm,
            paddingHorizontal: 8,
            paddingVertical: 3,
          },
        ]}
      >
        <Ionicons name={DAY_TYPE_ICONS[day.dayType] as any} size={12} color={accent} />
        <Text
          style={[
            typography.labelSmall,
            { color: accent, marginLeft: 4 },
          ]}
        >
          {DAY_TYPE_LABELS[day.dayType]}
        </Text>
      </View>
    );
  };

  const renderDayCard = (day: WorkoutDayLocal, dayIndex: number) => {
    const accent = DAY_TYPE_COLORS[day.dayType];

    switch (day.dayType) {
      case 'rest':
        return (
          <Card key={day.id} style={{ marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: accent }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                  {renderDayTypeBadge(day)}
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, marginTop: 2 }]}>{day.name}</Text>
              </View>
              <Ionicons name="bed-outline" size={28} color={accent} style={{ opacity: 0.6 }} />
            </View>
            {day.recoveryNotes ? (
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                {day.recoveryNotes}
              </Text>
            ) : null}
          </Card>
        );

      case 'mobility':
        return (
          <Card key={day.id} style={{ marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: accent }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                  {renderDayTypeBadge(day)}
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, marginTop: 2 }]}>{day.name}</Text>
              </View>
              <Ionicons name="body-outline" size={28} color={accent} style={{ opacity: 0.6 }} />
            </View>
            {day.recoveryNotes ? (
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                {day.recoveryNotes}
              </Text>
            ) : null}
            {day.exercises.length > 0 && renderExerciseList(day.exercises, accent)}
          </Card>
        );

      case 'cardio':
        return (
          <Card key={day.id} style={{ marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: accent }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                  {renderDayTypeBadge(day)}
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, marginTop: 2 }]}>{day.name}</Text>
              </View>
              <Ionicons name="heart-outline" size={28} color={accent} style={{ opacity: 0.6 }} />
            </View>
            {day.cardioSuggestions && day.cardioSuggestions.length > 0 &&
              renderCardioSuggestions(day.cardioSuggestions)}
            {day.exercises.length > 0 && renderExerciseList(day.exercises, accent)}
          </Card>
        );

      case 'active_recovery':
        return (
          <Card key={day.id} style={{ marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: accent }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                  {renderDayTypeBadge(day)}
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, marginTop: 2 }]}>{day.name}</Text>
              </View>
              <Ionicons name="walk-outline" size={28} color={accent} style={{ opacity: 0.6 }} />
            </View>
            {day.recoveryNotes ? (
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
                {day.recoveryNotes}
              </Text>
            ) : null}
            {day.exercises.length > 0 && renderExerciseList(day.exercises, accent)}
          </Card>
        );

      case 'lifting':
      default:
        return (
          <Card key={day.id} style={{ marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: accent }}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={[typography.label, { color: colors.textTertiary }]}>Day {day.dayNumber}</Text>
                  {renderDayTypeBadge(day)}
                </View>
                <Text style={[typography.labelLarge, { color: colors.text, marginTop: 2 }]}>{day.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleStartDay(dayIndex)}
                style={[
                  styles.startButton,
                  { backgroundColor: colors.primary, borderRadius: radius.md },
                ]}
              >
                <Ionicons name="play" size={16} color={colors.textInverse} />
                <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>
                  Start
                </Text>
              </TouchableOpacity>
            </View>
            {renderExerciseList(day.exercises, accent)}
          </Card>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]} numberOfLines={1}>
          {program.name}
        </Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}
        <Card style={{ marginBottom: spacing.base }}>
          <View style={styles.metaRow}>
            <Badge label={`${program.daysPerWeek} days/week`} variant="info" />
            <Badge
              label={program.difficulty.charAt(0).toUpperCase() + program.difficulty.slice(1)}
              variant="default"
            />
            {program.createdBy === 'ai' && <Badge label="AI Generated" variant="pro" />}
          </View>
          {program.description ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {program.description}
            </Text>
          ) : null}
          {program.isActive ? (
            <View style={[styles.activeProgramBanner, { backgroundColor: colors.activeMuted, borderRadius: radius.md, marginTop: spacing.md }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Active Program</Text>
            </View>
          ) : (
            <Button
              title="Switch to This Program"
              variant="secondary"
              size="md"
              onPress={() => {
                const doSwitch = () => setActiveProgram(program.id);
                if (Platform.OS === 'web') {
                  const ok = window.confirm('Switch your active program? This will replace your current program on the workout tab.');
                  if (ok) doSwitch();
                } else {
                  crossPlatformAlert(
                    'Switch Program',
                    'Switch your active program? This will replace your current program on the workout tab.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Switch', onPress: doSwitch },
                    ],
                  );
                }
              }}
              style={{ marginTop: spacing.md }}
            />
          )}
        </Card>

        {/* Days */}
        {program.days.map((day, dayIndex) => renderDayCard(day, dayIndex))}
      </ScrollView>

      <WorkoutSummaryModal
        visible={showSummary}
        session={completedSession}
        onDone={handleSummaryDone}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardioSubCard: {
    overflow: 'hidden',
  },
  cardioSubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeProgramBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
