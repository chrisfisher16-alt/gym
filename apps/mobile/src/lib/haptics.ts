// ── Haptic Feedback Service ───────────────────────────────────────
// Centralized haptic feedback for consistent tactile responses.
// Lazy-loads expo-haptics to avoid web crashes.

import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;

if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch (e) { console.warn('[Haptics] module unavailable:', e); }
}

// ── Primitives ──────────────────────────────────────────────────

/** Light impact -- button presses, minor interactions */
export function lightImpact() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium impact -- set completion, significant actions */
export function mediumImpact() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy impact -- major milestones */
export function heavyImpact() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Selection feedback -- stepper +/-, tab switches, toggles */
export function selectionFeedback() {
  Haptics?.selectionAsync();
}

/** Success notification -- PR detection, achievement unlock, workout finish */
export function successNotification() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning notification -- timer completion (double pulse feel) */
export function warningNotification() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error notification -- destructive actions, errors */
export function errorNotification() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

// ── Extended Vocabulary ─────────────────────────────────────────

/** Selection feedback when an ExpandableCard expands */
export function cardExpand() {
  Haptics?.selectionAsync();
}

/** Selection feedback (lighter) when an ExpandableCard collapses */
export function cardCollapse() {
  Haptics?.selectionAsync();
}

/** Medium impact when QuickActionSheet appears */
export function quickActionAppear() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Light impact when +/- buttons change weight */
export function weightIncrement() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Selection feedback when swipe gesture triggers action */
export function swipeAction() {
  Haptics?.selectionAsync();
}

/** Heavy impact + success notification when achievement/milestone unlocked */
export async function milestoneEarned() {
  await Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await new Promise(resolve => setTimeout(resolve, 120));
  await Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Triple light impact (3× with 50ms gaps) when water is logged */
export function waterLogged() {
  if (!Haptics) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setTimeout(() => Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light), 50);
  setTimeout(() => Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light), 100);
}

/** Heavy impact when workout begins */
export function workoutStarted() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success notification when workout completed */
export function workoutFinished() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Selection feedback when pull-to-refresh hits threshold */
export function pullToRefreshThreshold() {
  Haptics?.selectionAsync();
}
