import React, { useMemo, useState, useEffect } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { useWorkoutStore } from '../../stores/workout-store';
import { useNutritionStore } from '../../stores/nutrition-store';
import { useCoachStore } from '../../stores/coach-store';
import { useWorkoutPrograms } from '../../hooks/useWorkoutPrograms';
import { useWorkoutHistory } from '../../hooks/useWorkoutHistory';
import { checkAIMessageLimit, type UsageCheck } from '../../lib/usage-limits';
import { useEntitlement } from '../../hooks/useEntitlement';
import { getDateString } from '../../lib/nutrition-utils';

// ── Types ──────────────────────────────────────────────────────────

type TabName = 'today' | 'workout' | 'nutrition' | 'progress' | 'coach';

interface SmartHeaderProps {
  tab: TabName;
  /** Optional display name for Today tab greeting context */
  displayName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const fmt = (n: number) => Math.round(n).toLocaleString();

// ── Per-Tab Context Hooks ──────────────────────────────────────────

function useTodayContext(displayName?: string) {
  const todayWorkoutStatus = useWorkoutStore((s) => s.todayWorkoutStatus);
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const history = useWorkoutStore((s) => s.history);
  const targets = useNutritionStore((s) => s.targets);
  const todayConsumed = useNutritionStore((s) => s.todayConsumed);
  const { activeProgram, getTodayWorkout } = useWorkoutPrograms();

  return useMemo(() => {
    const status = todayWorkoutStatus();
    const timeOfDay = getTimeOfDay();
    const todayWorkout = activeProgram ? getTodayWorkout() : null;

    // During active workout — show current exercise progress
    if (status === 'active' && activeSession) {
      const totalExercises = activeSession.exercises.length;
      const completedExercises = activeSession.exercises.filter(
        (e) => e.sets.every((s) => s.isCompleted) || e.isSkipped,
      ).length;
      const currentExercise = activeSession.exercises.find(
        (e) => !e.sets.every((s) => s.isCompleted) && !e.isSkipped,
      );
      const currentSetIndex = currentExercise
        ? currentExercise.sets.filter((s) => s.isCompleted).length + 1
        : 0;
      const totalSets = currentExercise?.sets.length ?? 0;

      if (currentExercise && totalSets > 0) {
        return {
          text: `Set ${currentSetIndex} of ${totalSets} — ${currentExercise.exerciseName}`,
          animatedValue: undefined,
          type: 'active' as const,
        };
      }
      return {
        text: `${completedExercises}/${totalExercises} exercises done`,
        animatedValue: undefined,
        type: 'active' as const,
      };
    }

    // Post-workout same day
    if (status === 'completed') {
      const todayStr = getDateString();
      const todayDone = history.find(
        (w) => getDateString(new Date(w.completedAt)) === todayStr,
      );
      if (todayDone?.totalVolume) {
        return {
          text: `Crushed it! `,
          animatedValue: todayDone.totalVolume,
          suffix: ' lbs moved',
          type: 'completed' as const,
        };
      }
      return { text: 'Workout complete — nice work today!', type: 'completed' as const };
    }

    // Morning with pending workout
    if (timeOfDay === 'morning' && todayWorkout) {
      const muscleLabel = todayWorkout.focusArea?.replace('_', ' ') ?? '';
      const dayLabel = todayWorkout.name;
      return {
        text: `${dayLabel}${muscleLabel ? ` · ${muscleLabel}` : ''} today`,
        type: 'pending' as const,
      };
    }

    // Evening with remaining calories
    if (timeOfDay === 'evening') {
      const consumed = todayConsumed();
      const remaining = Math.max(0, Math.round(targets.calories - consumed.calories));
      if (remaining > 0 && targets.calories > 0) {
        return {
          text: '',
          animatedValue: remaining,
          suffix: ' cal left — what\'s for dinner?',
          type: 'nutrition' as const,
        };
      }
    }

    return null;
  }, [todayWorkoutStatus, activeSession, history, targets, todayConsumed, activeProgram, getTodayWorkout, displayName]);
}

function useWorkoutContext() {
  const activeSession = useWorkoutStore((s) => s.activeSession);
  const history = useWorkoutStore((s) => s.history);
  const { activeProgram, getTodayWorkout } = useWorkoutPrograms();
  const [elapsed, setElapsed] = useState(0);

  // Live elapsed timer when workout is active
  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 60000));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [activeSession]);

  return useMemo(() => {
    // Active workout
    if (activeSession) {
      const totalExercises = activeSession.exercises.length;
      const completedExercises = activeSession.exercises.filter(
        (e) => e.sets.every((s) => s.isCompleted) || e.isSkipped,
      ).length;
      return {
        text: `${elapsed} min — ${activeSession.name}`,
        subtitle: `${completedExercises}/${totalExercises} exercises`,
        type: 'active' as const,
      };
    }

    // Post-workout cooldown (within 1 hour)
    const todayStr = getDateString();
    const todayDone = history.find(
      (w) => getDateString(new Date(w.completedAt)) === todayStr,
    );
    if (todayDone) {
      const msSince = Date.now() - new Date(todayDone.completedAt).getTime();
      if (msSince < 3600000) {
        return { text: 'Great session! Rest well.', type: 'completed' as const };
      }
    }

    // No active workout — show today's program day
    const todayWorkout = activeProgram ? getTodayWorkout() : null;
    if (todayWorkout) {
      return { text: `Ready to train · ${todayWorkout.name}`, type: 'pending' as const };
    }

    return { text: 'Ready to train', type: 'pending' as const };
  }, [activeSession, elapsed, history, activeProgram, getTodayWorkout]);
}

function useNutritionContext() {
  const targets = useNutritionStore((s) => s.targets);
  const todayConsumed = useNutritionStore((s) => s.todayConsumed);

  return useMemo(() => {
    const consumed = todayConsumed();
    const progress = targets.calories > 0 ? consumed.calories / targets.calories : 0;

    let colorKey: 'error' | 'warning' | 'success';
    if (progress < 0.33) {
      colorKey = 'error';
    } else if (progress < 0.66) {
      colorKey = 'warning';
    } else {
      colorKey = 'success';
    }

    return {
      consumed: Math.round(consumed.calories),
      target: Math.round(targets.calories),
      colorKey,
      type: 'nutrition' as const,
    };
  }, [targets, todayConsumed]);
}

function useProgressContext() {
  const { history, totalPRs } = useWorkoutHistory();

  return useMemo(() => {
    // Week number since first workout
    let weekNumber = 0;
    if (history.length > 0) {
      const sorted = [...history].sort(
        (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
      );
      const firstDate = new Date(sorted[0].completedAt);
      const now = new Date();
      weekNumber = Math.max(1, Math.ceil((now.getTime() - firstDate.getTime()) / (7 * 86400000)));
    }

    // PRs this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prsThisMonth = history.filter(
      (w) => new Date(w.completedAt) >= monthStart && w.prCount > 0,
    ).reduce((sum, w) => sum + w.prCount, 0);

    // Trend: compare this month's volume to last month's
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    let thisMonthVol = 0;
    let lastMonthVol = 0;
    for (const s of history) {
      const d = new Date(s.completedAt);
      if (d >= monthStart) thisMonthVol += s.totalVolume;
      else if (d >= lastMonthStart && d <= lastMonthEnd) lastMonthVol += s.totalVolume;
    }

    let trend: '↑' | '→' | '↓';
    if (lastMonthVol === 0 && thisMonthVol > 0) trend = '↑';
    else if (thisMonthVol > lastMonthVol * 1.05) trend = '↑';
    else if (thisMonthVol < lastMonthVol * 0.95) trend = '↓';
    else trend = '→';

    if (history.length === 0) {
      return null;
    }

    return { weekNumber, prsThisMonth, trend, type: 'progress' as const };
  }, [history, totalPRs]);
}

function useCoachContext() {
  const messages = useCoachStore((s) => s.messages);
  const { tier } = useEntitlement();
  const [aiUsage, setAIUsage] = useState<UsageCheck | null>(null);

  useEffect(() => {
    if (tier === 'free') {
      checkAIMessageLimit().then(setAIUsage);
    }
  }, [tier, messages.length]);

  return useMemo(() => {
    // For free tier, show remaining messages
    if (tier === 'free' && aiUsage) {
      if (aiUsage.remaining <= 0) {
        return { text: 'Daily limit reached', type: 'limit' as const };
      }
      if (aiUsage.remaining === 1) {
        return { text: '1 message left — make it count', type: 'low' as const };
      }
      if (aiUsage.used === 0) {
        return { text: 'Ask me anything', type: 'ready' as const };
      }
      return { text: `${aiUsage.remaining} messages left today`, type: 'active' as const };
    }

    // Paid users or no usage data
    if (messages.length === 0) {
      return { text: 'Ask me anything', type: 'ready' as const };
    }
    return null;
  }, [tier, aiUsage, messages.length]);
}

// ── Main Component ─────────────────────────────────────────────────

export function SmartHeader({ tab, displayName }: SmartHeaderProps) {
  const { colors, typography, spacing } = useTheme();

  const todayCtx = useTodayContext(tab === 'today' ? displayName : undefined);
  const workoutCtx = useWorkoutContext();
  const nutritionCtx = useNutritionContext();
  const progressCtx = useProgressContext();
  const coachCtx = useCoachContext();

  const subtitleStyle: TextStyle = {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  };

  // ── Today Tab ────────────────────────────────────────────────────
  if (tab === 'today') {
    if (!todayCtx) return null;

    if (todayCtx.animatedValue != null) {
      return (
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={subtitleStyle}>{todayCtx.text}</Text>
            <AnimatedNumber
              value={todayCtx.animatedValue}
              style={subtitleStyle}
            />
            {'suffix' in todayCtx && todayCtx.suffix ? (
              <Text style={subtitleStyle}>{todayCtx.suffix}</Text>
            ) : null}
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={subtitleStyle}>{todayCtx.text}</Text>
      </Animated.View>
    );
  }

  // ── Workout Tab ──────────────────────────────────────────────────
  if (tab === 'workout') {
    if (!workoutCtx) return null;

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={subtitleStyle}>{workoutCtx.text}</Text>
        {'subtitle' in workoutCtx && workoutCtx.subtitle ? (
          <Text style={[subtitleStyle, { marginTop: 0 }]}>{workoutCtx.subtitle}</Text>
        ) : null}
      </Animated.View>
    );
  }

  // ── Nutrition Tab ────────────────────────────────────────────────
  if (tab === 'nutrition') {
    const accentColor =
      nutritionCtx.colorKey === 'error'
        ? colors.error
        : nutritionCtx.colorKey === 'warning'
          ? colors.warning
          : colors.success;

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <AnimatedNumber
            value={nutritionCtx.consumed}
            style={[subtitleStyle, { color: accentColor }]}
          />
          <Text style={subtitleStyle}> / </Text>
          <AnimatedNumber
            value={nutritionCtx.target}
            style={subtitleStyle}
          />
          <Text style={subtitleStyle}> cal</Text>
        </View>
      </Animated.View>
    );
  }

  // ── Progress Tab ─────────────────────────────────────────────────
  if (tab === 'progress') {
    if (!progressCtx) return null;

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={subtitleStyle}>
          Week {progressCtx.weekNumber} · {progressCtx.prsThisMonth} PR{progressCtx.prsThisMonth !== 1 ? 's' : ''} this month {progressCtx.trend}
        </Text>
      </Animated.View>
    );
  }

  // ── Coach Tab ────────────────────────────────────────────────────
  if (tab === 'coach') {
    if (!coachCtx) return null;

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={[subtitleStyle, coachCtx.type === 'low' ? { color: colors.warning } : undefined]}>{coachCtx.text}</Text>
      </Animated.View>
    );
  }

  return null;
}
