import { Platform } from 'react-native';
import type { ActiveWorkoutSession } from '../types/workout';

let _Notifications: typeof import('expo-notifications') | null = null;
let _notificationsLoaded = false;

function getNotifications() {
  if (!_notificationsLoaded && Platform.OS !== 'web') {
    _notificationsLoaded = true;
    try {
      _Notifications = require('expo-notifications');
    } catch (e) {
      console.warn('expo-notifications not available:', e);
      _Notifications = null;
    }
  }
  return _Notifications;
}

let activeNotificationId: string | null = null;

/** Get current exercise info from the session */
function getWorkoutNotificationContent(session: ActiveWorkoutSession) {
  const currentExercise = session.exercises[session.currentExerciseIndex];
  if (!currentExercise) return null;

  const completedSets = currentExercise.sets.filter((s) => s.isCompleted).length;
  const totalSets = currentExercise.sets.length;
  const completedExercises = session.exercises.filter(
    (e) => e.sets.every((s) => s.isCompleted) || e.isSkipped,
  ).length;
  const totalExercises = session.exercises.length;

  // Find next incomplete set to show target weight/reps
  const nextSet = currentExercise.sets.find((s) => !s.isCompleted);
  let targetInfo = '';
  if (nextSet?.weight && nextSet?.reps) {
    targetInfo = ` · ${nextSet.weight} × ${nextSet.reps}`;
  }

  return {
    title: `🏋️ ${currentExercise.exerciseName}`,
    body: `${completedSets}/${totalSets} sets · ${completedExercises}/${totalExercises} exercises${targetInfo}`,
  };
}

/** Show or update the workout notification */
export async function showWorkoutNotification(
  session: ActiveWorkoutSession,
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') return;

  const content = getWorkoutNotificationContent(session);
  if (!content) return;

  // Dismiss existing notification before showing new one
  if (activeNotificationId) {
    try {
      await Notifications.dismissNotificationAsync(activeNotificationId);
    } catch {}
  }

  activeNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { type: 'workout_active' } as Record<string, unknown>,
      categoryIdentifier: 'workout_active',
      sound: false, // silent — don't buzz on every update
      sticky: Platform.OS === 'android', // Android: non-dismissible
    },
    trigger: null, // immediate
  });
}

/** Update notification with rest timer info */
export async function showRestTimerNotification(
  session: ActiveWorkoutSession,
  secondsRemaining: number,
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') return;

  const currentExercise = session.exercises[session.currentExerciseIndex];
  if (!currentExercise) return;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (activeNotificationId) {
    try {
      await Notifications.dismissNotificationAsync(activeNotificationId);
    } catch {}
  }

  activeNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏱️ Rest Timer — ${timeStr}`,
      body: `Next: ${currentExercise.exerciseName}`,
      data: { type: 'workout_active' } as Record<string, unknown>,
      categoryIdentifier: 'workout_active',
      sound: false,
      sticky: Platform.OS === 'android',
    },
    trigger: null,
  });
}

/** Clear the workout notification */
export async function clearWorkoutNotification(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  if (activeNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(activeNotificationId);
    } catch {}
    activeNotificationId = null;
  }

  // Also dismiss any presented notifications of this type
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const data = n.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'workout_active') {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {}
}
