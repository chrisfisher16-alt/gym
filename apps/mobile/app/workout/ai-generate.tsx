import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { Card } from '../../src/components/ui';
import { sendAIMessage, type AIClientResponse } from '../../src/lib/ai-client';
import type { AIMessage } from '../../src/lib/ai-provider';
import { useWorkoutStore } from '../../src/stores/workout-store';
import { fuzzyMatch } from '../../src/lib/fuzzy-search';
import { useProfileStore } from '../../src/stores/profile-store';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useEntitlement } from '../../src/hooks/useEntitlement';
import { usePaywall } from '../../src/hooks/usePaywall';
import { checkWorkoutLogLimit, incrementUsage } from '../../src/lib/usage-limits';

// ── Quick prompts ──────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────

interface ParsedWorkout {
  name: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps: string;
    restSeconds: number;
    notes?: string;
  }>;
}

interface WorkoutChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  workout?: ParsedWorkout | null;
}

// ── Context builder ─────────────────────────────────────────────────

function buildWorkoutContext(): string {
  const profile = useProfileStore.getState().profile;
  const { history, programs, exercises } = useWorkoutStore.getState();

  const lines: string[] = [];

  const goalLabels: Record<string, string> = {
    lose_weight: 'Lose Weight',
    gain_muscle: 'Gain Muscle',
    build_lean_muscle: 'Build Lean Muscle',
    improve_endurance: 'Improve Endurance',
    maintain_weight: 'Maintain Weight',
    improve_general_health: 'Improve General Health',
  };
  if (profile.healthGoals?.length) {
    lines.push(`Goals: ${profile.healthGoals.map((g) => goalLabels[g] ?? g).join(', ')}`);
  }
  if (profile.primaryGoal) {
    lines.push(`Primary goal: ${profile.primaryGoal}`);
  }
  if (profile.trainingExperience) {
    lines.push(`Training experience: ${profile.trainingExperience}`);
  }
  if (profile.trainingDaysPerWeek) {
    lines.push(`Training days/week: ${profile.trainingDaysPerWeek}`);
  }
  if (profile.injuriesOrLimitations) {
    lines.push(`Injuries/limitations: ${profile.injuriesOrLimitations}`);
  }

  const equipment = profile.fitnessEquipment ?? profile.availableEquipment ?? [];
  if (equipment.length > 0) {
    lines.push(`Available equipment: ${equipment.join(', ')}`);
  }

  const recent = history.slice(-5);
  if (recent.length > 0) {
    lines.push('\nRecent workouts:');
    for (const session of recent) {
      const exerciseNames = session.exercises.map((e) => e.exerciseName).join(', ');
      lines.push(
        `- ${session.name} (${new Date(session.startedAt).toLocaleDateString()}): ${exerciseNames}`,
      );
    }
  }

  const activeProgram = programs.find((p) => p.isActive);
  if (activeProgram) {
    lines.push(
      `\nActive program: ${activeProgram.name} (${activeProgram.difficulty}, ${activeProgram.daysPerWeek} days/week)`,
    );
  }

  const exerciseNames = exercises
    .filter((e) => e.category !== 'warmup' && e.category !== 'cooldown')
    .map((e) => e.name);
  lines.push(
    `\nAvailable exercises in the app's library (use ONLY these exact names):\n${exerciseNames.join(', ')}`,
  );

  return lines.join('\n');
}

// ── System prompt ──────────────────────────────────────────────────

function buildChatWorkoutSystemPrompt(): string {
  const ctx = buildWorkoutContext();

  return `You are a workout programming AI for a health and fitness app. You generate and refine workout sessions based on conversation with the user. Use their profile, equipment, experience, and recent activity to personalize workouts.

## User Context
${ctx}

## Requirements
- ONLY use exercises from the "Available exercises" list above. Use the EXACT exercise names.
- Respect the user's injuries/limitations — avoid movements that aggravate them.
- Match volume and intensity to the user's experience level.
- Consider recent workouts to avoid overtraining the same muscle groups back-to-back.
- Use appropriate equipment based on what the user has.
- Include 4–8 exercises per workout.
- Sets: 2–5 per exercise. Reps: appropriate for the goal (e.g. "6-8" for strength, "8-12" for hypertrophy, "12-15" for endurance).
- Rest seconds: 60–90 for hypertrophy, 120–180 for strength, 30–60 for conditioning.

## Conversation Style
- When the user requests a workout, propose one using the structured format below.
- When the user asks for modifications (e.g. "swap squats for leg press", "add more chest work", "make it shorter"), apply the changes and output a new structured workout.
- Keep your conversational text concise — a brief description before or after the workout block.

## Output Format
When proposing a workout, wrap the JSON in ~~~workout fences:

~~~workout
{"name": "Workout Name", "exercises": [{"name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "rest_seconds": 90, "notes": "Focus on controlled tempo"}]}
~~~

You can include natural language before and/or after the workout block. Always include the ~~~workout block whenever you are proposing or updating a workout.`;
}

// ── Exercise matching ──────────────────────────────────────────────

function findExerciseMatch(name: string, exercises: { id: string; name: string }[]) {
  // 1. Exact match (case-insensitive)
  const exact = exercises.find(
    (e) => e.name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return exact;

  // 2. Fuzzy match — take highest scoring above threshold
  const scored = exercises
    .map((e) => ({ exercise: e, score: fuzzyMatch(name, e.name) }))
    .filter(({ score }) => score > 0.4)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.exercise;
}

// ── Parsing ────────────────────────────────────────────────────────

function parseWorkoutFromResponse(content: string): ParsedWorkout | null {
  const match = content.match(/~~~workout\n([\s\S]*?)\n~~~/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const library = useWorkoutStore.getState().exercises;
    return {
      name: data.name,
      exercises: data.exercises.map((e: { name: string; sets?: number; reps?: string; rest?: number; rest_seconds?: number; notes?: string }) => {
        const libMatch = findExerciseMatch(e.name, library);
        return {
          exerciseId: libMatch?.id ?? `custom_${e.name.toLowerCase().replace(/\s+/g, '_')}`,
          exerciseName: libMatch?.name ?? e.name,
          targetSets: e.sets ?? 3,
          targetReps: e.reps ?? '8-12',
          restSeconds: e.rest_seconds ?? 90,
          notes: e.notes,
        };
      }),
    };
  } catch {
    return null;
  }
}

function stripWorkoutBlock(content: string): string {
  return content.replace(/~~~workout\n[\s\S]*?\n~~~/g, '').trim();
}

// ── Component ──────────────────────────────────────────────────────

export default function AIGenerateWorkoutScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const { canAccess } = useEntitlement();
  const { showPaywall } = usePaywall();

  const [messages, setMessages] = useState<WorkoutChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const systemPromptRef = useRef<string | null>(null);

  // Build system prompt lazily on first use
  function getSystemPrompt(): string {
    if (!systemPromptRef.current) {
      systemPromptRef.current = buildChatWorkoutSystemPrompt();
    }
    return systemPromptRef.current;
  }

  // Scroll to end when messages change or streaming updates
  useEffect(() => {
    if (messages.length > 0 || streamingContent) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingContent, isLoading]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim();
      if (!text || isLoading) return;

      setInputText('');
      setError(null);

      const userMsg: WorkoutChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingContent('');
      setIsStreaming(false);

      // Build AI history from existing messages
      const aiHistory: AIMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response: AIClientResponse = await sendAIMessage(text, {
          history: aiHistory,
          systemPrompt: getSystemPrompt(),
          context: 'workout',
          onToken: (token) => {
            setStreamingContent((prev) => prev + token);
            setIsStreaming(true);
          },
        });

        const workout = parseWorkoutFromResponse(response.content);
        const assistantMsg: WorkoutChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          workout,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate workout';
        setError(msg);
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        setIsStreaming(false);
      }
    },
    [inputText, isLoading, messages],
  );

  const handleStartWorkout = useCallback(
    (workout: ParsedWorkout) => {
      if (activeSession) {
        crossPlatformAlert(
          'Workout in Progress',
          'Please finish or cancel your current workout first.',
        );
        return;
      }

      const proceed = () => {
        startWorkout({
          name: workout.name,
          exercises: workout.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            restSeconds: e.restSeconds,
          })),
        });

        router.replace('/workout/active');
      };

      if (canAccess('unlimited_workouts')) {
        proceed();
        return;
      }

      checkWorkoutLogLimit().then((usage) => {
        if (usage.allowed) {
          incrementUsage('workout_logs');
          proceed();
        } else {
          crossPlatformAlert(
            'Workout Limit Reached',
            `You've used all ${usage.limit} free workouts this month. Upgrade for unlimited workouts.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => showPaywall({ feature: 'unlimited_workouts', source: 'ai_generate' }) },
            ],
          );
        }
      });
    },
    [activeSession, startWorkout, router, canAccess, showPaywall],
  );

  // ── Inline components ────────────────────────────────────────────

  const WorkoutCard = ({ workout }: { workout: ParsedWorkout }) => (
    <Card style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
      <View style={[styles.workoutCardHeader, { marginBottom: spacing.md }]}>
        <Ionicons name="barbell-outline" size={20} color={colors.primary} />
        <Text
          style={[typography.labelLarge, { color: colors.text, marginLeft: spacing.sm, flex: 1 }]}
        >
          {workout.name}
        </Text>
      </View>

      {workout.exercises.map((exercise, idx) => (
        <View
          key={`${exercise.exerciseId}-${idx}`}
          style={[
            styles.exerciseRow,
            {
              paddingVertical: spacing.sm,
              borderTopWidth: idx > 0 ? 1 : 0,
              borderTopColor: colors.borderLight,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textTertiary, width: 22 }]}>
            {idx + 1}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>
              {exercise.exerciseName}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
              {exercise.targetSets} sets × {exercise.targetReps} reps · {exercise.restSeconds}s
              rest
            </Text>
            {exercise.notes && (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, marginTop: 2, fontStyle: 'italic' },
                ]}
              >
                {exercise.notes}
              </Text>
            )}
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={() => handleStartWorkout(workout)}
        activeOpacity={0.8}
        style={[
          styles.startButton,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            marginTop: spacing.md,
          },
        ]}
      >
        <Ionicons name="play" size={18} color={colors.textInverse} />
        <Text
          style={[
            typography.labelLarge,
            { color: colors.textInverse, marginLeft: spacing.sm },
          ]}
        >
          Start This Workout
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderMessage = ({ item }: { item: WorkoutChatMessage }) => {
    const isUser = item.role === 'user';
    const displayText = isUser ? item.content : stripWorkoutBlock(item.content);

    return (
      <View style={{ marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
        {/* Text bubble */}
        {displayText.length > 0 && (
          <View
            style={[
              styles.bubble,
              {
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                backgroundColor: isUser ? colors.primary : colors.surfaceSecondary,
                borderRadius: radius.lg,
                padding: spacing.md,
                maxWidth: '85%',
              },
            ]}
          >
            <Text
              style={[
                typography.body,
                { color: isUser ? colors.textInverse : colors.text },
              ]}
            >
              {displayText}
            </Text>
          </View>
        )}

        {/* Workout card if present */}
        {item.workout && <WorkoutCard workout={item.workout} />}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { padding: spacing.base }]}>
      <Ionicons name="sparkles" size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
      <Text style={[typography.h2, { color: colors.text, textAlign: 'center' }]}>
        AI Workout Builder
      </Text>
      <Text
        style={[
          typography.body,
          {
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: spacing.sm,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        Describe what you want to train, or pick a quick option below. You can refine the workout through conversation.
      </Text>

      <View style={[styles.chipGrid, { marginTop: spacing.lg }]}>
        {QUICK_PROMPTS.map((qp) => (
          <TouchableOpacity
            key={qp.label}
            activeOpacity={0.7}
            onPress={() => handleSend(qp.prompt)}
            style={[
              styles.chip,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <Text style={[typography.label, { color: colors.text }]}>{qp.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStreamingFooter = () => {
    if (isStreaming && streamingContent) {
      const displayText = stripWorkoutBlock(streamingContent);
      const streamingWorkout = parseWorkoutFromResponse(streamingContent);
      return (
        <View style={{ marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
          {displayText.length > 0 && (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: 'flex-start',
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  maxWidth: '85%',
                },
              ]}
            >
              <Text style={[typography.body, { color: colors.text }]}>{displayText}</Text>
            </View>
          )}
          {streamingWorkout && <WorkoutCard workout={streamingWorkout} />}
        </View>
      );
    }

    if (isLoading) {
      return (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            alignSelf: 'flex-start',
          }}
        >
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <Text style={[typography.body, { color: colors.textSecondary }]}>Thinking…</Text>
          </View>
        </View>
      );
    }

    return null;
  };

  // ── Main render ──────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderLight,
            paddingTop: Platform.OS === 'ios' ? 52 : spacing.base,
            paddingBottom: spacing.md,
            paddingHorizontal: spacing.base,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={[typography.labelLarge, { color: colors.text }]}>AI Workout</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {isLoading ? 'Generating…' : 'Build your workout'}
          </Text>
        </View>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
      </View>

      {/* Messages or empty state */}
      {messages.length === 0 && !isLoading ? (
        renderEmptyState()
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderStreamingFooter}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Error banner */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: `${colors.error}15`,
              padding: spacing.sm,
              marginHorizontal: spacing.md,
              borderRadius: radius.md,
            },
          ]}
        >
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginLeft: spacing.xs, flex: 1 },
            ]}
            numberOfLines={2}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
              if (lastUserMsg) handleSend(lastUserMsg.content);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[typography.label, { color: colors.error }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input area */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.base,
              paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
              color: colors.text,
              fontSize: 14,
              maxHeight: 100,
            },
          ]}
          placeholder="Describe your workout or refine…"
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          blurOnSubmit={false}
          onKeyPress={(e: NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean }>) => {
            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault?.();
              handleSend();
            }
          }}
          editable={!isLoading}
        />
        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          style={[
            styles.sendButton,
            {
              backgroundColor:
                inputText.trim() && !isLoading ? colors.primary : colors.surfaceSecondary,
              borderRadius: radius.full,
              width: 40,
              height: 40,
              marginLeft: spacing.sm,
            },
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() && !isLoading ? colors.textInverse : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {},
  bubble: {},
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
