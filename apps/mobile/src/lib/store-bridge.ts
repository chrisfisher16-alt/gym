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
 * Synchronous boolean guards to prevent health ↔ measurement circular updates.
 * Each flag is set before the cross-store write and cleared in a finally block,
 * so the paired subscription always sees the flag regardless of sync/async timing.
 */
let isHealthSyncing = false;
let isMeasurementSyncing = false;

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

// ── Batched XP ──────────────────────────────────────────────────────
// Accumulates rapid XP awards and flushes them in a single store update.
let pendingXP = 0;
let xpFlushTimeout: NodeJS.Timeout | null = null;

function batchAwardXP(amount: number, reason?: string) {
  pendingXP += amount;
  if (xpFlushTimeout) clearTimeout(xpFlushTimeout);
  xpFlushTimeout = setTimeout(() => {
    if (pendingXP > 0) {
      useAchievementsStore.getState().awardXP(pendingXP, reason ?? 'workout');
      pendingXP = 0;
    }
    xpFlushTimeout = null;
  }, 100); // 100ms debounce — batches rapid completions
}

// ── Bridge ──────────────────────────────────────────────────────────

export function initializeStoreBridge(): () => void {
  if (bridgeInitialized) return () => {};
  bridgeInitialized = true;

  const unsubscribers: (() => void)[] = [];

  // ── 1+2+8. Consolidated workout store subscription ─────────────
  // Single subscription handles: workout completion (XP + achievements),
  // set completion (XP), and sync enqueue.
  let lastHistoryLength = useWorkoutStore.getState().history.length;
  let lastCompletedSets = countCompletedSets();
  let lastHistoryIds = new Set(
    useWorkoutStore.getState().history.map((s) => s.id),
  );

  unsubscribers.push(
    useWorkoutStore.subscribe((state) => {
      // ── Workout completion → Achievement check + XP
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

      // ── Set completion → XP (batched)
      if (!state.activeSession) {
        lastCompletedSets = 0;
      } else {
        const currentSets = countCompletedSets();
        if (currentSets > lastCompletedSets) {
          const newSets = currentSets - lastCompletedSets;
          lastCompletedSets = currentSets;
          batchAwardXP(newSets * 10, 'set_complete');
        } else {
          lastCompletedSets = currentSets;
        }
      }

      // ── Sync: enqueue new workout completions
      if (isMergeInProgress()) {
        lastHistoryIds = new Set(state.history.map((s) => s.id));
      } else {
        const currentIds = new Set(state.history.map((s) => s.id));
        for (const session of state.history) {
          if (!lastHistoryIds.has(session.id)) {
            enqueueWorkoutSession(session).then(() => {
              processQueue().catch((e) => console.warn('[StoreBridge] processQueue failed:', e));
            }).catch((e) => console.warn('[StoreBridge] enqueue failed:', e));
          }
        }
        lastHistoryIds = currentIds;
      }
    }),
  );

  // ── 3. Meal logged → XP (batched) ─────────────────────────────
  // When a new meal is added, award 15 XP.
  let lastMealCount = countTotalMeals();

  unsubscribers.push(
    useNutritionStore.subscribe(() => {
      const currentCount = countTotalMeals();
      if (currentCount > lastMealCount) {
        const newMeals = currentCount - lastMealCount;
        lastMealCount = currentCount;
        batchAwardXP(newMeals * 15, 'meal_logged');
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
        batchAwardXP(5, 'water_logged');
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
        !isHealthSyncing &&
        !isMeasurementSyncing
      ) {
        lastHealthWeight = currentWeight;
        isHealthSyncing = true;
        useMeasurementsStore
          .getState()
          .addWeightFromHealthSync(currentWeight, new Date().toISOString())
          .catch(err => console.warn('[StoreBridge] Measurement sync failed:', err))
          .finally(() => {
            isHealthSyncing = false;
          });
      }
    }),
  );

  // ── 6. Measurements latest weight → Health store ──────────────
  // When a manual weight entry is added, sync to health-store.recentWeight.
  let lastMeasurementsLength = useMeasurementsStore.getState().measurements.length;

  unsubscribers.push(
    useMeasurementsStore.subscribe((state) => {
      // Skip if this change came from a health sync (circular guard)
      if (isHealthSyncing || isMeasurementSyncing) return;

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
        isMeasurementSyncing = true;
        try {
          useHealthStore.getState().setRecentWeight(latest.weightKg);
        } finally {
          isMeasurementSyncing = false;
        }
      }
    }),
  );

  // ── 7. Smart notifications on launch (5-second delay) ──────────
  const smartNotifTimer = setTimeout(() => {
    scheduleSmartNotifications().catch((err) =>
      console.warn('Smart notification scheduling failed:', err),
    );
  }, 5000);

  // ── 8. (Consolidated into subscription 1+2+8 above) ────────────

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
    if (xpFlushTimeout) clearTimeout(xpFlushTimeout);
    stopAutoSync();
    for (const unsub of unsubscribers) {
      unsub();
    }
    pendingXP = 0;
    xpFlushTimeout = null;
    bridgeInitialized = false;
  };
}
