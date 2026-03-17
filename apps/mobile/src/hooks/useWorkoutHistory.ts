import { useMemo } from 'react';
import { useWorkoutStore } from '../stores/workout-store';
import type { CompletedSession, DayVolume } from '../types/workout';
import { getWeeklyVolume } from '../lib/workout-utils';

export function useWorkoutHistory() {
  const history = useWorkoutStore((s) => s.history);

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      ),
    [history],
  );

  const recentWorkouts = useMemo(
    () => sortedHistory.slice(0, 3),
    [sortedHistory],
  );

  const weeklyVolume: DayVolume[] = useMemo(
    () => getWeeklyVolume(history, 1),
    [history],
  );

  const getSessionById = (id: string): CompletedSession | null => {
    return history.find((s) => s.id === id) ?? null;
  };

  const totalWorkouts = history.length;

  const totalVolume = useMemo(
    () => history.reduce((sum, s) => sum + s.totalVolume, 0),
    [history],
  );

  const totalPRs = useMemo(
    () => history.reduce((sum, s) => sum + s.prCount, 0),
    [history],
  );

  // Group by date for calendar view
  const historyByDate = useMemo(() => {
    const map = new Map<string, CompletedSession[]>();
    for (const session of sortedHistory) {
      const dateKey = new Date(session.completedAt).toISOString().split('T')[0];
      const existing = map.get(dateKey) ?? [];
      existing.push(session);
      map.set(dateKey, existing);
    }
    return map;
  }, [sortedHistory]);

  return {
    history: sortedHistory,
    recentWorkouts,
    weeklyVolume,
    getSessionById,
    totalWorkouts,
    totalVolume,
    totalPRs,
    historyByDate,
  };
}
