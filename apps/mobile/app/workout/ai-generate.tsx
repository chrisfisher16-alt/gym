import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card, Button, ScreenContainer } from '../../src/components/ui';
import { generateWorkout, type GenerateWorkoutResult } from '../../src/lib/ai-workout-generator';
import { useWorkoutStore } from '../../src/stores/workout-store';

const QUICK_PROMPTS = [
  { label: 'Push Day', prompt: 'Push day — chest, shoulders, and triceps' },
  { label: 'Pull Day', prompt: 'Pull day — back and biceps' },
  { label: 'Leg Day', prompt: 'Leg day — quads, hamstrings, and glutes' },
  { label: 'Upper Body', prompt: 'Upper body hypertrophy workout' },
  { label: 'Lower Body', prompt: 'Lower body strength workout' },
  { label: 'Full Body', prompt: 'Full body workout with compound movements' },
  { label: 'Core & Abs', prompt: 'Core and abs focused session' },
  { label: 'Quick 30min', prompt: 'Quick 30-minute full body workout with minimal rest' },
];

export default function AIGenerateWorkoutScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const activeSession = useWorkoutStore((s) => s.activeSession);

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateWorkoutResult | null>(null);

  const handleGenerate = useCallback(async (input: string) => {
    const text = input.trim();
    if (!text) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const workout = await generateWorkout({ prompt: text });
      setResult(workout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate workout';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleStartWorkout = useCallback(() => {
    if (!result) return;

    if (activeSession) {
      Alert.alert(
        'Workout in Progress',
        'Please finish or cancel your current workout first.',
      );
      return;
    }

    startWorkout({
      name: result.name,
      exercises: result.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        restSeconds: e.restSeconds,
      })),
    });

    router.replace('/workout/active');
  }, [result, activeSession, startWorkout, router]);

  const handleRegenerate = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // ── Result View ──────────────────────────────────────────────────

  if (result) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
          <TouchableOpacity onPress={handleRegenerate}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
            {result.name}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {result.exercises.map((exercise, idx) => (
            <Card key={`${exercise.exerciseId}-${idx}`} style={{ marginBottom: spacing.sm }}>
              <View style={styles.exerciseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: colors.text }]}>
                    {exercise.exerciseName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {exercise.targetSets} sets × {exercise.targetReps} reps · {exercise.restSeconds}s rest
                  </Text>
                  {exercise.notes && (
                    <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2, fontStyle: 'italic' }]}>
                      {exercise.notes}
                    </Text>
                  )}
                </View>
                <Text style={[typography.h3, { color: colors.textTertiary }]}>
                  {idx + 1}
                </Text>
              </View>
            </Card>
          ))}

          <View style={{ gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing['2xl'] }}>
            <Button
              title="Start This Workout"
              onPress={handleStartWorkout}
              icon={<Ionicons name="play" size={18} color={colors.textInverse} />}
            />
            <Button
              title="Regenerate"
              variant="secondary"
              onPress={handleRegenerate}
              icon={<Ionicons name="refresh-outline" size={18} color={colors.primary} />}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ── Prompt View ──────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
            AI Workout
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Card style={{ marginBottom: spacing.base }}>
            <View style={[styles.sparkleHeader, { marginBottom: spacing.md }]}>
              <Ionicons name="sparkles" size={22} color="#8B5CF6" />
              <Text style={[typography.h3, { color: colors.text, marginLeft: spacing.sm }]}>
                Generate a Workout
              </Text>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Describe what you want to train and the AI will build a workout using your
              experience level, equipment, and recent activity.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  color: colors.text,
                  padding: spacing.md,
                  minHeight: 80,
                  ...typography.body,
                },
              ]}
              placeholder="e.g. Heavy chest and triceps, or a quick full body session..."
              placeholderTextColor={colors.textTertiary}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isGenerating}
            />

            {error && (
              <View style={{ backgroundColor: `${colors.error}15`, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
                <Text style={[typography.bodySmall, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                title={isGenerating ? 'Generating...' : 'Generate Workout'}
                onPress={() => handleGenerate(prompt)}
                disabled={isGenerating || !prompt.trim()}
                loading={isGenerating}
                icon={!isGenerating ? <Ionicons name="sparkles" size={18} color={colors.textInverse} /> : undefined}
              />
            </View>
          </Card>

          {/* Quick prompts */}
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Quick Picks
          </Text>
          <View style={styles.chipGrid}>
            {QUICK_PROMPTS.map((qp) => (
              <TouchableOpacity
                key={qp.label}
                activeOpacity={0.7}
                disabled={isGenerating}
                onPress={() => {
                  setPrompt(qp.prompt);
                  handleGenerate(qp.prompt);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    opacity: isGenerating ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[typography.label, { color: colors.text }]}>
                  {qp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    textAlignVertical: 'top',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  chip: {},
});
