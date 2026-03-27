import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { crossPlatformAlert } from '../../../src/lib/cross-platform-alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme';
import { useWorkoutPrograms } from '../../../src/hooks/useWorkoutPrograms';
import { useExerciseLibrary } from '../../../src/hooks/useExerciseLibrary';
import { Button, Card, SegToggle } from '../../../src/components/ui';
import { MUSCLE_GROUP_LABELS } from '../../../src/lib/exercise-data';
import { generateId } from '../../../src/lib/workout-utils';
import { sendAIMessage } from '../../../src/lib/ai-client';
import { parseCoachActions } from '../../../src/lib/coach-actions';
import { useWorkoutStore } from '../../../src/stores/workout-store';
import { selectionFeedback } from '../../../src/lib/haptics';
import type { MuscleGroup, ProgramExercise, WorkoutProgramLocal } from '../../../src/types/workout';
import type { CreateWeeklyPlanAction } from '../../../src/lib/coach-actions';

const FOCUS_AREAS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'full_body'];
const DIFFICULTIES: WorkoutProgramLocal['difficulty'][] = ['beginner', 'intermediate', 'advanced'];

type CreateMode = 'manual' | 'ai';

interface DayDraft {
  name: string;
  focusArea: MuscleGroup;
  exercises: ProgramExercise[];
}

function buildProgramGenerationPrompt(): string {
  const { exercises } = useWorkoutStore.getState();

  const byCategory: Record<string, string[]> = {};
  for (const ex of exercises) {
    const cat = ex.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(`${ex.id}:${ex.name}`);
  }

  const exerciseLib = Object.entries(byCategory)
    .map(([cat, entries]) => `  ${cat}: ${entries.join(', ')}`)
    .join('\n');

  return `You are a workout program generator. The user will describe what kind of program they want. Your ONLY job is to output a single [ACTION] block with type "create_weekly_plan".

## Output Format
Respond with ONLY an [ACTION] block — no extra text, no explanation, no markdown. Just the action block.

Here is the EXACT JSON schema you must follow. Use these EXACT camelCase field names:

[ACTION]{"type":"create_weekly_plan","name":"Push Pull Legs","description":"A 3-day PPL split","daysPerWeek":3,"difficulty":"intermediate","days":[{"dayNumber":1,"name":"Push Day","dayType":"lifting","focusArea":"chest","exercises":[{"exerciseId":"ex_bench_press","exerciseName":"Barbell Bench Press","targetSets":4,"targetReps":"8-12","restSeconds":90,"notes":"Warm up with lighter sets first"}]}]}[/ACTION]

## Field Names (MUST use exact camelCase)
- dayNumber, dayType, focusArea, recoveryNotes
- exerciseId, exerciseName, targetSets, targetReps, restSeconds, notes
- daysPerWeek

## Rules
- dayType must be one of: "lifting", "rest", "mobility", "cardio", "active_recovery"
- focusArea must be one of: "chest", "back", "shoulders", "legs", "arms", "core", "cardio", "full_body"
- Only include lifting days in the program (no rest days). The user's daysPerWeek should equal the number of days you include.
- Include 4-8 exercises per lifting day with appropriate sets/reps/rest for the user's goal
- exerciseId and exerciseName MUST come from the Exercise Library below — do not invent exercises
- targetReps must be a string like "8-12" or "10" or "20, 18, 15, 12, 10"
- targetSets must be a number
- restSeconds must be a number (in seconds)
- Include notes for exercises where helpful (warm-up cues, tempo, form tips)
- Tailor difficulty, volume, and exercise selection to what the user describes

## Exercise Library (exerciseId:exerciseName format)
${exerciseLib}`;
}

export default function CreateProgramScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const { createProgram } = useWorkoutPrograms();
  const { allExercises } = useExerciseLibrary();

  // Mode toggle
  const [mode, setMode] = useState<CreateMode>('manual');

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Form state (shared between manual and AI-populated)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [difficulty, setDifficulty] = useState<WorkoutProgramLocal['difficulty']>('intermediate');
  const [days, setDays] = useState<DayDraft[]>([
    { name: 'Day 1', focusArea: 'chest', exercises: [] },
  ]);
  const [showExercisePicker, setShowExercisePicker] = useState<number | null>(null);

  const addDay = () => {
    setDays([...days, { name: `Day ${days.length + 1}`, focusArea: 'back', exercises: [] }]);
  };

  const removeDay = (index: number) => {
    setDays(days.filter((_, i) => i !== index));
  };

  const updateDay = (index: number, updates: Partial<DayDraft>) => {
    setDays(days.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };

  const addExerciseToDay = (dayIndex: number, exerciseId: string) => {
    const exercise = allExercises.find((e) => e.id === exerciseId);
    if (!exercise) return;

    const day = days[dayIndex];
    const pe: ProgramExercise = {
      id: generateId('pe'),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetSets: exercise.defaultSets,
      targetReps: exercise.defaultReps,
      restSeconds: exercise.defaultRestSeconds,
      order: day.exercises.length,
    };

    updateDay(dayIndex, { exercises: [...day.exercises, pe] });
    setShowExercisePicker(null);
  };

  const removeExerciseFromDay = (dayIndex: number, exerciseIndex: number) => {
    const day = days[dayIndex];
    updateDay(dayIndex, {
      exercises: day.exercises.filter((_, i) => i !== exerciseIndex),
    });
  };

  const handleGenerateAI = useCallback(async () => {
    if (!aiPrompt.trim()) {
      crossPlatformAlert('Error', 'Please describe the program you want');
      return;
    }

    Keyboard.dismiss();
    setAiLoading(true);
    setAiError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const systemPrompt = buildProgramGenerationPrompt();
      const response = await sendAIMessage(aiPrompt.trim(), {
        systemPrompt,
        context: 'workout',
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      // Parse the create_weekly_plan action from the response
      const { actions } = parseCoachActions(response.content);
      const planAction = actions.find(
        (a): a is CreateWeeklyPlanAction => a.type === 'create_weekly_plan',
      );

      if (!planAction) {
        setAiError('The AI did not generate a valid program. Try rephrasing your request.');
        return;
      }

      // Normalize exercise fields — AI may return snake_case or camelCase
      const normalizeExercise = (e: any, idx: number): ProgramExercise => {
        const exerciseId = e.exerciseId || e.exercise_id || '';
        const exerciseName = e.exerciseName || e.exercise_name || e.name || exerciseId;
        const targetSets = e.targetSets ?? e.target_sets ?? 3;
        const targetReps = String(e.targetReps ?? e.target_reps ?? '10');
        const restSeconds = e.restSeconds ?? e.rest_seconds ?? 60;
        const notes = e.notes || undefined;
        return {
          id: generateId('pe'),
          exerciseId,
          exerciseName,
          targetSets: Number(targetSets),
          targetReps,
          restSeconds: Number(restSeconds),
          order: idx,
          ...(notes ? { notes } : {}),
        };
      };

      const normalizeDay = (d: any) => {
        const dayType = d.dayType || d.day_type || 'lifting';
        const focusArea = (d.focusArea || d.focus_area || 'full_body') as MuscleGroup;
        const exercises = (d.exercises || []).map(normalizeExercise);
        return { name: d.name || `Day ${d.dayNumber || d.day_number || ''}`, focusArea, dayType, exercises };
      };

      // Populate form fields with the AI result
      setName(planAction.name || '');
      setDescription(planAction.description || '');
      setDaysPerWeek(planAction.daysPerWeek || (planAction as any).days_per_week || 4);
      setDifficulty(planAction.difficulty || 'intermediate');
      const normalizedDays = planAction.days.map(normalizeDay);
      setDays(
        normalizedDays
          .filter((d) => d.dayType === 'lifting' || d.exercises.length > 0)
          .map((d) => ({
            name: d.name,
            focusArea: d.focusArea,
            exercises: d.exercises,
          })),
      );
      setAiGenerated(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setAiError(err?.message || 'Failed to generate program. Check your AI settings.');
    } finally {
      setAiLoading(false);
      abortRef.current = null;
    }
  }, [aiPrompt]);

  const handleCancelAI = useCallback(() => {
    abortRef.current?.abort();
    setAiLoading(false);
  }, []);

  const resetAI = useCallback(() => {
    setAiGenerated(false);
    setAiError(null);
    setName('');
    setDescription('');
    setDaysPerWeek(4);
    setDifficulty('intermediate');
    setDays([{ name: 'Day 1', focusArea: 'chest', exercises: [] }]);
  }, []);

  const handleSave = () => {
    if (!name.trim()) {
      crossPlatformAlert('Error', 'Please enter a program name');
      return;
    }
    if (days.length === 0) {
      crossPlatformAlert('Error', 'Please add at least one day');
      return;
    }

    createProgram({
      name: name.trim(),
      description: description.trim(),
      daysPerWeek,
      difficulty,
      days: days.map((d, i) => ({
        dayNumber: i + 1,
        name: d.name,
        dayType: 'lifting' as const,
        focusArea: d.focusArea,
        exercises: d.exercises,
      })),
    });

    router.back();
  };

  const handleModeChange = useCallback((value: CreateMode) => {
    selectionFeedback();
    setMode(value);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.base }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
          Create Program
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode Toggle */}
        <View style={{ marginBottom: spacing.lg }}>
          <SegToggle
            options={[
              { value: 'manual' as CreateMode, label: 'Manual' },
              { value: 'ai' as CreateMode, label: 'AI Autofill' },
            ]}
            selected={mode}
            onSelect={handleModeChange}
          />
        </View>

        {/* ── AI Mode ── */}
        {mode === 'ai' && !aiGenerated && (
          <View>
            <Card style={{ marginBottom: spacing.md }}>
              <View style={styles.aiHeaderRow}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={[typography.label, { color: colors.text, marginLeft: spacing.sm }]}>
                  Describe your program
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md }]}>
                Tell the AI what kind of workout program you want — goals, days per week, focus areas, difficulty, or any preferences.
              </Text>
              <TextInput
                style={[
                  styles.aiPromptInput,
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                  },
                ]}
                placeholder={'e.g. "4-day push/pull/legs split for intermediate lifters focused on hypertrophy"'}
                placeholderTextColor={colors.textTertiary}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!aiLoading}
              />

              {aiError && (
                <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderRadius: radius.sm, marginTop: spacing.md }]}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={[typography.caption, { color: colors.error, marginLeft: spacing.xs, flex: 1 }]}>
                    {aiError}
                  </Text>
                </View>
              )}

              <View style={{ marginTop: spacing.md }}>
                {aiLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[typography.label, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>
                      Generating your program...
                    </Text>
                    <TouchableOpacity onPress={handleCancelAI}>
                      <Text style={[typography.label, { color: colors.error }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Button
                    title="Generate Program"
                    onPress={handleGenerateAI}
                    icon={<Ionicons name="sparkles" size={18} color={colors.textInverse} />}
                  />
                )}
              </View>
            </Card>
          </View>
        )}

        {/* AI Generated banner */}
        {mode === 'ai' && aiGenerated && (
          <View style={[styles.aiBanner, { backgroundColor: colors.primaryMuted, borderRadius: radius.md, marginBottom: spacing.md }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm, flex: 1 }]}>
              AI-generated — review and edit below
            </Text>
            <TouchableOpacity onPress={resetAI}>
              <Text style={[typography.labelSmall, { color: colors.primary }]}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Manual Form (also shown after AI generates) ── */}
        {(mode === 'manual' || aiGenerated) && (
          <>
            {/* Program Name */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm }]}>
              Program Name *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                typography.body,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
              ]}
              placeholder="e.g. My Training Plan"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
            />

            {/* Description */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.textInput,
                typography.body,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
              ]}
              placeholder="Optional description"
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
            />

            {/* Days Per Week */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
              Days Per Week
            </Text>
            <View style={styles.numberRow}>
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setDaysPerWeek(n)}
                  style={[
                    styles.numberChip,
                    {
                      backgroundColor: daysPerWeek === n ? colors.primary : colors.surface,
                      borderColor: daysPerWeek === n ? colors.primary : colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.label,
                      { color: daysPerWeek === n ? colors.textInverse : colors.text },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Difficulty */}
            <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.lg }]}>
              Difficulty
            </Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: difficulty === d ? colors.primary : colors.surface,
                      borderColor: difficulty === d ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: difficulty === d ? colors.textInverse : colors.text, textTransform: 'capitalize' },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Days */}
            <Text style={[typography.labelLarge, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
              Workout Days
            </Text>

            {days.map((day, dayIndex) => (
              <Card key={dayIndex} style={{ marginBottom: spacing.md }}>
                <View style={styles.dayHeaderRow}>
                  <TextInput
                    style={[typography.labelLarge, { color: colors.text, flex: 1 }]}
                    value={day.name}
                    onChangeText={(text: string) => updateDay(dayIndex, { name: text })}
                    placeholder="Day name"
                    placeholderTextColor={colors.textTertiary}
                  />
                  {days.length > 1 && (
                    <TouchableOpacity onPress={() => removeDay(dayIndex)}>
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Focus Area */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
                >
                  {FOCUS_AREAS.map((fa) => (
                    <TouchableOpacity
                      key={fa}
                      onPress={() => updateDay(dayIndex, { focusArea: fa })}
                      style={[
                        styles.miniChip,
                        {
                          backgroundColor: day.focusArea === fa ? colors.primaryMuted : colors.surfaceSecondary,
                          borderRadius: radius.sm,
                          marginRight: spacing.xs,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: day.focusArea === fa ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {MUSCLE_GROUP_LABELS[fa]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Exercises in day */}
                {day.exercises.map((ex, exIndex) => (
                  <View
                    key={ex.id}
                    style={[styles.exerciseInDay, { borderBottomColor: colors.borderLight }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
                        {ex.exerciseName}
                      </Text>
                      {ex.notes && (
                        <Text style={[typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                          {ex.notes}
                        </Text>
                      )}
                    </View>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginRight: spacing.sm }]}>
                      {ex.targetSets}×{ex.targetReps}
                    </Text>
                    <TouchableOpacity onPress={() => removeExerciseFromDay(dayIndex, exIndex)}>
                      <Ionicons name="remove-circle-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Exercise picker inline */}
                {showExercisePicker === dayIndex ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <ScrollView style={{ maxHeight: 200 }}>
                      {allExercises
                        .filter((e) => e.category === day.focusArea || day.focusArea === 'full_body')
                        .slice(0, 20)
                        .map((ex) => (
                          <TouchableOpacity
                            key={ex.id}
                            onPress={() => addExerciseToDay(dayIndex, ex.id)}
                            style={[styles.pickerItem, { borderBottomColor: colors.borderLight }]}
                          >
                            <Text style={[typography.body, { color: colors.primary }]}>{ex.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity onPress={() => setShowExercisePicker(null)}>
                      <Text style={[typography.labelSmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowExercisePicker(dayIndex)}
                    style={[styles.addExerciseBtn, { marginTop: spacing.sm }]}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.xs }]}>
                      Add Exercise
                    </Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))}

            <TouchableOpacity
              onPress={addDay}
              style={[
                styles.addDayBtn,
                { borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.xl },
              ]}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={[typography.label, { color: colors.primary, marginLeft: spacing.sm }]}>Add Day</Text>
            </TouchableOpacity>

            <Button title="Save Program" onPress={handleSave} />
          </>
        )}
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
  textInput: {
    borderWidth: 1,
    minHeight: 48,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numberChip: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseInDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pickerItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiPromptInput: {
    borderWidth: 1,
    minHeight: 100,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
});
