// ── Store Bridge ──────────────────────────────────────────────────────
// Sets up cross-store Zustand subscriptions so stores react to each other's
// state changes without tight coupling.
//
// Call `initializeStoreBridge()` once from the root layout useEffect.

import { useWorkoutStore } from '../stores/workout-store';
import { useAchievementsStore } from '../stores/achievements-store';
import { useHealthStore } from '../stores/health-store';
import { useMeasurementsStore } from '../stores/measurements-store';
import { useNutritionStore } from '../stores/nutrition-store';
import { scheduleSmartNotifications } from './notification-scheduler';
import { startAutoSync, stopAutoSync, processQueue } from './supabase-sync';
import { enqueueWorkoutSession, mergeWorkoutHistory, isMergeInProgress } from './workout-sync';

let bridgeInitialized = false;

/**
 * Guard flag to prevent health → measurement → health circular updates.
 * When true, the measurements→health subscription skips firing.
 */
let healthSyncInProgress = false;

// ── Helpers ─────────────────────────────────────────────────────────

/** Count total completed sets across the active workout session. */
function countCompletedSets(): number {
  const session = useWorkoutStore.getState().activeSession;
  if (!session) return 0;
  let count = 0;
  for (const exercise of session.exercises) {
    for (const s of exercise.sets) {
      if (s.isCompleted) count++;
    }
  }
  return count;
}

/** Count total meals across all daily logs. */
function countTotalMeals(): number {
  const logs = useNutritionStore.getState().dailyLogs;
  let total = 0;
  for (const log of Object.values(logs)) {
    if (log.meals) {
      total += log.meals.length;
    }
  }
  return total;
}

/** Sum total water intake across all daily logs. */
function sumTotalWater(): number {
  const logs = useNutritionStore.getState().dailyLogs;
  let total = 0;
  for (const log of Object.values(logs)) {
    total += log.waterIntake_oz ?? 0;
  }
  return total;
}

// ── Bridge ──────────────────────────────────────────────────────────

export function initializeStoreBridge(): () => void {
  if (bridgeInitialized) return () => {};
  bridgeInitialized = true;

  const unsubscribers: (() => void)[] = [];

  // ── 1. Workout completion → Achievement check + XP ─────────────
  // When history length increases, check for new achievements and award XP.
  let lastHistoryLength = useWorkoutStore.getState().history.length;

  unsubscribers.push(
    useWorkoutStore.subscribe((state) => {
      const currentLength = state.history.length;
      if (currentLength > lastHistoryLength) {
        lastHistoryLength = currentLength;
        // Defer to avoid calling during render
        setTimeout(() => {
          useAchievementsStore.getState().checkAchievements();
          useAchievementsStore.getState().awardXP(100, 'workout_complete');
          // Re-calculate smart notifications with updated history
          scheduleSmartNotifications().catch((err) =>
            console.warn('Smart notification scheduling failed:', err),
          );
        }, 100);
      }
    }),
  );

  // ── 2. Set completion → XP ─────────────────────────────────────
  // When a set is completed in the active session, award 10 XP.
  let lastCompletedSets = countCompletedSets();

  unsubscribers.push(
    useWorkoutStore.subscribe((state) => {
      if (!state.activeSession) {
        lastCompletedSets = 0;
        return;
      }
      const currentSets = countCompletedSets();
      if (currentSets > lastCompletedSets) {
        const newSets = currentSets - lastCompletedSets;
        lastCompletedSets = currentSets;
        setTimeout(() => {
          for (let i = 0; i < newSets; i++) {
            useAchievementsStore.getState().awardXP(10, 'set_complete');
          }
        }, 50);
      } else {
        lastCompletedSets = currentSets;
      }
    }),
  );

  // ── 3. Meal logged → XP ───────────────────────────────────────
  // When a new meal is added, award 15 XP.
  let lastMealCount = countTotalMeals();

  unsubscribers.push(
    useNutritionStore.subscribe(() => {
      const currentCount = countTotalMeals();
      if (currentCount > lastMealCount) {
        const newMeals = currentCount - lastMealCount;
        lastMealCount = currentCount;
        setTimeout(() => {
          for (let i = 0; i < newMeals; i++) {
            useAchievementsStore.getState().awardXP(15, 'meal_logged');
          }
        }, 50);
      } else {
        lastMealCount = currentCount;
      }
    }),
  );

  // ── 4. Water logged → XP ──────────────────────────────────────
  // When water intake increases, award 5 XP per log event.
  let lastWaterTotal = sumTotalWater();

  unsubscribers.push(
    useNutritionStore.subscribe(() => {
      const currentTotal = sumTotalWater();
      if (currentTotal > lastWaterTotal) {
        lastWaterTotal = currentTotal;
        setTimeout(() => {
          useAchievementsStore.getState().awardXP(5, 'water_logged');
        }, 50);
      } else {
        lastWaterTotal = currentTotal;
      }
    }),
  );

  // ── 5. Health store weight → Measurements store ────────────────
  // When health-store recentWeight changes, create a health_sync measurement.
  let lastHealthWeight = useHealthStore.getState().recentWeight;

  unsubscribers.push(
    useHealthStore.subscribe((state) => {
      const currentWeight = state.recentWeight;
      if (
        currentWeight != null &&
        currentWeight !== lastHealthWeight &&
        !healthSyncInProgress
      ) {
        lastHealthWeight = currentWeight;
        healthSyncInProgress = true;
        try {
          useMeasurementsStore
            .getState()
            .addWeightFromHealthSync(currentWeight, new Date().toISOString());
        } finally {
          // Reset after a tick to allow the measurements subscription to skip
          setTimeout(() => {
            healthSyncInProgress = false;
          }, 0);
        }
      }
    }),
  );

  // ── 6. Measurements latest weight → Health store ──────────────
  // When a manual weight entry is added, sync to health-store.recentWeight.
  let lastMeasurementsLength = useMeasurementsStore.getState().measurements.length;

  unsubscribers.push(
    useMeasurementsStore.subscribe((state) => {
      // Skip if this change came from a health sync (circular guard)
      if (healthSyncInProgress) return;

      const currentLength = state.measurements.length;
      if (currentLength <= lastMeasurementsLength) {
        lastMeasurementsLength = currentLength;
        return;
      }
      lastMeasurementsLength = currentLength;

      // Find the latest weight entry that was NOT from health_sync
      const latest = state.measurements
        .filter((m) => m.weightKg != null && m.source !== 'health_sync')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (latest?.weightKg != null) {
        useHealthStore.getState().setRecentWeight(latest.weightKg);
      }
    }),
  );

  // ── 7. Smart notifications on launch (5-second delay) ──────────
  const smartNotifTimer = setTimeout(() => {
    scheduleSmartNotifications().catch((err) =>
      console.warn('Smart notification scheduling failed:', err),
    );
  }, 5000);

  // ── 8. Sync: enqueue new workout completions ───────────────────
  // When a new session is added to history, enqueue it for Supabase sync.
  let lastHistoryIds = new Set(
    useWorkoutStore.getState().history.map((s) => s.id),
  );

  unsubscribers.push(
    useWorkoutStore.subscribe((state) => {
      // Skip if this change came from a remote merge (avoid re-enqueuing)
      if (isMergeInProgress()) {
        lastHistoryIds = new Set(state.history.map((s) => s.id));
        return;
      }
      const currentIds = new Set(state.history.map((s) => s.id));
      for (const session of state.history) {
        if (!lastHistoryIds.has(session.id)) {
          // New session detected — enqueue for sync (non-blocking)
          enqueueWorkoutSession(session).then(() => {
            processQueue().catch(() => {});
          }).catch(() => {});
        }
      }
      lastHistoryIds = currentIds;
    }),
  );

  // ── 9. Sync: auto-process queue on connectivity + merge remote ─
  startAutoSync();

  // Merge remote workout history after a delay (non-blocking)
  const mergeTimer = setTimeout(() => {
    mergeWorkoutHistory().catch((err) =>
      console.warn('Workout history merge failed:', err),
    );
  }, 3000);

  // Return cleanup function
  return () => {
    clearTimeout(smartNotifTimer);
    clearTimeout(mergeTimer);
    stopAutoSync();
    for (const unsub of unsubscribers) {
      unsub();
    }
    bridgeInitialized = false;
  };
}
