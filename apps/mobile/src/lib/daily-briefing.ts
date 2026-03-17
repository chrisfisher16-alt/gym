// ── Daily Briefing ──────────────────────────────────────────────────
// AI-generated daily briefing for the Today tab.
// Gathers context from stores, calls Claude, and caches per day.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAIConfig, callAI, type AIMessage } from './ai-provider';
import { useProfileStore } from '../stores/profile-store';
import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { calculateDailyTotals } from './nutrition-utils';

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
    profile.trainingExperience ? `Experience: ${profile.trainingExperience}` : null,
    profile.trainingDaysPerWeek ? `Training days/week: ${profile.trainingDaysPerWeek}` : null,
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
  const activeProgram = workoutState.programs.find((p) => p.isActive);
  let todayWorkoutInfo = 'No active program';
  if (activeProgram) {
    const dayOfWeekNum = now.getDay();
    const dayNumber = ((dayOfWeekNum === 0 ? 7 : dayOfWeekNum) % activeProgram.days.length) + 1;
    const todayDay = activeProgram.days.find((d) => d.dayNumber === dayNumber) ?? activeProgram.days[0];
    if (todayDay) {
      todayWorkoutInfo = `Today's workout: ${todayDay.name} (${todayDay.exercises.length} exercises) from program "${activeProgram.name}"`;
    }
  }

  // Nutrition
  const nutritionState = useNutritionStore.getState();
  const todayKey = now.toISOString().split('T')[0];
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
  'You are a fitness coach creating a daily briefing. Be concise (3-4 sentences). Include: what workout is planned today (if any), nutrition focus, and a motivational note based on recent progress. Be encouraging but direct. Do not use markdown formatting — write plain text only.';

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
  const today = new Date().toISOString().split('T')[0];
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

    const response = await callAI(messages, config);
    const briefing = response.content.trim();

    await cacheBriefing(today, briefing);
    return briefing;
  } catch (error) {
    console.warn('Failed to generate daily briefing:', error);
    return getRandomFallback();
  }
}
