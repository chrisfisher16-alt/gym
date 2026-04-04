// ── Daily Briefing ──────────────────────────────────────────────────
// AI-generated daily briefing for the Today tab.
// Gathers context from stores, calls Claude, and caches per day.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { useProfileStore } from '../stores/profile-store';
import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { calculateDailyTotals, getDateString } from './nutrition-utils';

// ── Storage ──────────────────────────────────────────────────────────

const BRIEFING_KEY_PREFIX = '@briefing/';

function getBriefingKey(date: string): string {
  return `${BRIEFING_KEY_PREFIX}${date}`;
}

export async function getCachedBriefing(date: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(getBriefingKey(date));
  } catch {
    return null;
  }
}

export async function cacheBriefing(date: string, text: string): Promise<void> {
  try {
    // Don't cache empty strings — they'd be returned as a valid cached briefing
    if (!text || text.trim().length === 0) return;
    await AsyncStorage.setItem(getBriefingKey(date), text);
  } catch {
    // Ignore storage errors
  }
}

// ── Context Gathering ────────────────────────────────────────────────

function gatherBriefingContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  // Profile
  const profile = useProfileStore.getState().profile;
  const profileInfo = [
    profile.displayName ? `Name: ${profile.displayName}` : null,
    profile.primaryGoal ? `Goal: ${profile.primaryGoal}` : null,
    profile.fitnessGoal ? `Fitness goal: ${profile.fitnessGoal.replace(/_/g, ' ')}` : null,
    profile.trainingExperience ? `Experience: ${profile.trainingExperience}` : null,
    profile.trainingDaysPerWeek ? `Training days/week: ${profile.trainingDaysPerWeek}` : null,
    profile.consistencyLevel ? `Consistency: ${profile.consistencyLevel.replace(/_/g, ' ')}` : null,
    profile.sessionDuration ? `Session length: ${profile.sessionDuration.replace(/_/g, ' ')}` : null,
    profile.gymType ? `Gym: ${profile.gymType.replace(/_/g, ' ')}` : null,
    profile.fitnessEquipment.length > 0 ? `Equipment: ${profile.fitnessEquipment.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Workout history (last 3)
  const workoutState = useWorkoutStore.getState();
  const history = [...workoutState.history]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 3);

  const workoutSummary = history.length > 0
    ? history
        .map((w) => {
          const date = new Date(w.completedAt).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          return `${date}: ${w.name} (${Math.round(w.totalVolume)}kg volume, ${Math.round(w.durationSeconds / 60)}min)`;
        })
        .join('; ')
    : 'No recent workouts';

  // Active program + today's workout
  // Use the same algorithm as useWorkoutPrograms.getTodayWorkout:
  // find the first uncompleted lifting day this week.
  const activeProgram = workoutState.programs.find((p) => p.isActive);
  let todayWorkoutInfo = 'No active program';
  if (activeProgram) {
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const completedDayIds = new Set<string>();
    for (const session of workoutState.history) {
      if (session.programId !== activeProgram.id || !session.dayId) continue;
      if (new Date(session.completedAt) < startOfWeek) break;
      completedDayIds.add(session.dayId);
    }

    const liftingDays = activeProgram.days.filter((d) => d.dayType === 'lifting');
    const todayDay = liftingDays.find((d) => !completedDayIds.has(d.id));

    if (todayDay) {
      todayWorkoutInfo = `Today's workout: ${todayDay.name} (${todayDay.exercises.length} exercises) from program "${activeProgram.name}"`;
    } else if (liftingDays.length > 0) {
      todayWorkoutInfo = `All lifting days completed this week in "${activeProgram.name}" — rest or extras`;
    }
  }

  // Nutrition
  const nutritionState = useNutritionStore.getState();
  const todayKey = getDateString(now);
  const todayLog = nutritionState.dailyLogs[todayKey];
  const todayMeals = todayLog?.meals ?? [];
  const consumed = calculateDailyTotals(todayMeals);
  const targets = nutritionState.targets;

  const nutritionInfo = todayMeals.length > 0
    ? `Consumed so far: ${Math.round(consumed.calories)} / ${targets.calories} cal, ${Math.round(consumed.protein_g)} / ${targets.protein_g}g protein, ${Math.round(consumed.carbs_g)} / ${targets.carbs_g}g carbs, ${Math.round(consumed.fat_g)} / ${targets.fat_g}g fat`
    : `No meals logged yet today. Targets: ${targets.calories} cal, ${targets.protein_g}g protein`;

  return [
    `Date: ${dateStr} (${dayOfWeek})`,
    profileInfo ? `User: ${profileInfo}` : null,
    `Recent workouts: ${workoutSummary}`,
    todayWorkoutInfo,
    `Nutrition: ${nutritionInfo}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Briefing Generation ──────────────────────────────────────────────

const BRIEFING_SYSTEM_PROMPT =
  'You are a fitness coach writing a brief daily check-in. STRICT LIMIT: 80 words maximum — no exceptions. Cover three areas in 1-2 sentences each: (1) today\'s workout plan, (2) nutrition tip, (3) quick motivation based on recent progress. Write plain text only — no markdown, no headers, no bullet points. Be direct and personal. You are EXCLUSIVELY a health and fitness coach — only discuss exercise, workouts, nutrition, and wellness topics.';

const FALLBACK_MESSAGES = [
  "New day, new opportunity. Stay consistent with your training and nutrition — that's where real results come from. You've got this!",
  "Today is another chance to move closer to your goals. Focus on quality reps, hit your protein target, and stay hydrated. Let's make it count!",
  "Consistency beats perfection. Show up, do the work, fuel your body well, and the results will follow. Keep pushing forward!",
  "Every workout counts. Whether it's a heavy day or active recovery, you're building something. Stay focused on your nutrition and trust the process.",
];

function getRandomFallback(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

export async function generateDailyBriefing(): Promise<string> {
  // Check cache first
  const today = getDateString();
  const cached = await getCachedBriefing(today);
  if (cached) return cached;

  try {
    const config = await getAIConfig();

    // Demo mode — return a fallback
    if (config.provider === 'demo') {
      const fallback = getRandomFallback();
      await cacheBriefing(today, fallback);
      return fallback;
    }

    const context = gatherBriefingContext();

    const messages: AIMessage[] = [
      { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
      { role: 'user', content: `Here is my current context for today's briefing:\n\n${context}` },
    ];

    const response = await callAI(messages, config, { max_tokens: 200 });
    const briefing = response.content.trim();

    // Only cache non-empty briefings
    if (briefing.length > 0) {
      await cacheBriefing(today, briefing);
    }
    return briefing || getRandomFallback();
  } catch (error) {
    console.warn('Failed to generate daily briefing:', error);
    return getRandomFallback();
  }
}
