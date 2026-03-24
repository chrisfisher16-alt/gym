import type { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../stores/workout-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { useMeasurementsStore } from '../stores/measurements-store';
import { useAchievementsStore } from '../stores/achievements-store';
import { ACHIEVEMENTS } from './achievements';

// ── Types ──────────────────────────────────────────────────────────

export type TimelineEntryType =
  | 'workout_started'
  | 'workout_completed'
  | 'meal_logged'
  | 'water_logged'
  | 'supplement_taken'
  | 'weight_logged'
  | 'pr_achieved'
  | 'achievement_earned';

export interface TimelineEntry {
  id: string;
  timestamp: Date;
  type: TimelineEntryType;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  details?: Record<string, unknown>;
}

// ── Icon / color config ────────────────────────────────────────────

const ENTRY_CONFIG: Record<TimelineEntryType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  workout_started:    { icon: 'barbell',          color: '#3B82F6' },  // blue
  workout_completed:  { icon: 'checkmark-circle', color: '#10B981' },  // green
  meal_logged:        { icon: 'restaurant',       color: '#F59E0B' },  // orange
  water_logged:       { icon: 'water',            color: '#3B82F6' },  // blue
  supplement_taken:   { icon: 'medical',          color: '#14B8A6' },  // teal
  weight_logged:      { icon: 'scale',            color: '#8B5CF6' },  // purple
  pr_achieved:        { icon: 'trophy',           color: '#C4A265' },  // gold
  achievement_earned: { icon: 'ribbon',           color: '#C4A265' },  // gold
};

// ── Helpers ────────────────────────────────────────────────────────

function isoDateMatch(isoString: string, targetDate: string): boolean {
  return isoString.startsWith(targetDate);
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k lbs`;
  return `${Math.round(vol)} lbs`;
}

// ── Aggregator ─────────────────────────────────────────────────────

/**
 * Aggregates timeline entries from all stores for the given date.
 * @param date - YYYY-MM-DD string
 * @returns entries sorted by timestamp descending (most recent first)
 */
export function aggregateTimeline(date: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // ── Workout entries ───────────────────────────────────────────
  const { history, activeSession } = useWorkoutStore.getState();

  // Completed sessions on this date
  for (const session of history) {
    if (!isoDateMatch(session.completedAt, date)) continue;

    const cfg = ENTRY_CONFIG.workout_completed;
    const volumeLbs = Math.round(session.totalVolume * 2.20462);
    const prText = session.prCount > 0 ? ` · ${session.prCount} PR${session.prCount > 1 ? 's' : ''}` : '';

    entries.push({
      id: `wc_${session.id}`,
      timestamp: new Date(session.completedAt),
      type: 'workout_completed',
      title: `Completed ${session.name}`,
      subtitle: `${formatVolume(volumeLbs)} · ${session.totalSets} sets${prText}`,
      icon: cfg.icon,
      iconColor: cfg.color,
      details: {
        durationSeconds: session.durationSeconds,
        exercises: session.exercises,
        totalVolume: volumeLbs,
        totalSets: session.totalSets,
        prCount: session.prCount,
        notes: session.notes,
        mood: session.mood,
      },
    });

    // Workout started entry
    if (isoDateMatch(session.startedAt, date)) {
      const startCfg = ENTRY_CONFIG.workout_started;
      entries.push({
        id: `ws_${session.id}`,
        timestamp: new Date(session.startedAt),
        type: 'workout_started',
        title: `Started ${session.name}`,
        icon: startCfg.icon,
        iconColor: startCfg.color,
      });
    }

    // PR entries from completed sets
    if (session.prCount > 0) {
      for (const exercise of session.exercises) {
        for (const s of exercise.sets) {
          if (s.isPR && isoDateMatch(s.completedAt, date)) {
            const prCfg = ENTRY_CONFIG.pr_achieved;
            const weightText = s.weight ? `${s.weight} lbs` : '';
            const repsText = s.reps ? `${s.reps} reps` : '';
            const setDetail = [weightText, repsText].filter(Boolean).join(' × ');
            entries.push({
              id: `pr_${session.id}_${s.id}`,
              timestamp: new Date(s.completedAt),
              type: 'pr_achieved',
              title: `PR: ${exercise.exerciseName}`,
              subtitle: setDetail || undefined,
              icon: prCfg.icon,
              iconColor: prCfg.color,
              details: {
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
                weight: s.weight,
                reps: s.reps,
              },
            });
          }
        }
      }
    }
  }

  // Active session (currently in progress today)
  if (activeSession && isoDateMatch(activeSession.startedAt, date)) {
    const startCfg = ENTRY_CONFIG.workout_started;
    // Only add if we didn't already add from a completed session with same id
    const alreadyHasStart = entries.some((e) => e.id === `ws_${activeSession.id}`);
    if (!alreadyHasStart) {
      entries.push({
        id: `ws_${activeSession.id}`,
        timestamp: new Date(activeSession.startedAt),
        type: 'workout_started',
        title: `Started ${activeSession.name}`,
        subtitle: 'In progress…',
        icon: startCfg.icon,
        iconColor: startCfg.color,
      });
    }
  }

  // ── Nutrition entries ─────────────────────────────────────────
  const { dailyLogs, userSupplements } = useNutritionStore.getState();
  const dayLog = dailyLogs[date];

  if (dayLog) {
    // Meal entries
    for (const meal of dayLog.meals) {
      const mealCfg = ENTRY_CONFIG.meal_logged;
      const totalCals = meal.items.reduce((sum, item) => sum + item.calories, 0);
      const topItems = meal.items.slice(0, 3).map((i) => i.name).join(', ');

      entries.push({
        id: `meal_${meal.id}`,
        timestamp: new Date(meal.timestamp),
        type: 'meal_logged',
        title: `Logged ${meal.name || meal.mealType}`,
        subtitle: `${topItems} · ${Math.round(totalCals)} cal`,
        icon: mealCfg.icon,
        iconColor: mealCfg.color,
        details: {
          mealType: meal.mealType,
          name: meal.name,
          items: meal.items,
          totalCalories: totalCals,
          totalProtein: meal.items.reduce((sum, item) => sum + item.protein_g, 0),
          totalCarbs: meal.items.reduce((sum, item) => sum + item.carbs_g, 0),
          totalFat: meal.items.reduce((sum, item) => sum + item.fat_g, 0),
        },
      });
    }

    // Supplement entries — no individual timestamps, use timeOfDay heuristic
    if (dayLog.supplementsTaken.length > 0) {
      const supCfg = ENTRY_CONFIG.supplement_taken;
      const supMap = new Map(userSupplements.map((s) => [s.id, s]));

      for (const supId of dayLog.supplementsTaken) {
        const sup = supMap.get(supId);
        if (!sup) continue;

        // Estimate time based on timeOfDay preference
        const hourEstimate = sup.timeOfDay === 'morning' ? 8
          : sup.timeOfDay === 'afternoon' ? 14
          : sup.timeOfDay === 'evening' ? 20
          : sup.timeOfDay === 'with_meals' ? 12
          : 9; // 'any' default

        const estimated = new Date(`${date}T${String(hourEstimate).padStart(2, '0')}:00:00`);

        entries.push({
          id: `sup_${supId}_${date}`,
          timestamp: estimated,
          type: 'supplement_taken',
          title: `Took ${sup.supplementName}`,
          subtitle: `${sup.dose} ${sup.unit}`,
          icon: supCfg.icon,
          iconColor: supCfg.color,
          details: {
            supplementId: sup.supplementId,
            supplementName: sup.supplementName,
            dose: sup.dose,
            unit: sup.unit,
          },
        });
      }
    }

    // Water — single entry for the day if any water logged
    if (dayLog.waterIntake_oz > 0) {
      const waterCfg = ENTRY_CONFIG.water_logged;
      // No precise timestamp — place at noon
      const noon = new Date(`${date}T12:00:00`);
      entries.push({
        id: `water_${date}`,
        timestamp: noon,
        type: 'water_logged',
        title: 'Water Intake',
        subtitle: `${dayLog.waterIntake_oz} oz today`,
        icon: waterCfg.icon,
        iconColor: waterCfg.color,
        details: {
          totalOz: dayLog.waterIntake_oz,
        },
      });
    }
  }

  // ── Measurement entries ───────────────────────────────────────
  const { measurements } = useMeasurementsStore.getState();

  for (const m of measurements) {
    if (!isoDateMatch(m.date, date)) continue;

    const cfg = ENTRY_CONFIG.weight_logged;
    const parts: string[] = [];
    if (m.weightKg != null) {
      const lbs = Math.round(m.weightKg * 2.20462 * 10) / 10;
      parts.push(`${lbs} lbs`);
    }
    if (m.waistCm != null) parts.push(`Waist: ${m.waistCm} cm`);

    entries.push({
      id: `meas_${m.id}`,
      timestamp: new Date(m.date),
      type: 'weight_logged',
      title: 'Body Measurement',
      subtitle: parts.join(' · ') || undefined,
      icon: cfg.icon,
      iconColor: cfg.color,
      details: {
        weightKg: m.weightKg,
        heightCm: m.heightCm,
        chestCm: m.chestCm,
        waistCm: m.waistCm,
        hipsCm: m.hipsCm,
        notes: m.notes,
        source: m.source,
      },
    });
  }

  // ── Achievement entries ───────────────────────────────────────
  const { earned } = useAchievementsStore.getState();

  for (const ea of earned) {
    if (!isoDateMatch(ea.dateEarned, date)) continue;

    const achDef = ACHIEVEMENTS.find((a) => a.id === ea.id);
    const cfg = ENTRY_CONFIG.achievement_earned;

    entries.push({
      id: `ach_${ea.id}`,
      timestamp: new Date(ea.dateEarned),
      type: 'achievement_earned',
      title: achDef?.name ?? 'Achievement Earned',
      subtitle: achDef?.description,
      icon: cfg.icon,
      iconColor: cfg.color,
      details: {
        achievementId: ea.id,
        name: achDef?.name,
        description: achDef?.description,
      },
    });
  }

  // ── Sort descending by timestamp (most recent first) ──────────
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return entries;
}
