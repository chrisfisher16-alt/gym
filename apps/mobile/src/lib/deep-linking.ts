// ── Deep Linking Configuration ────────────────────────────────────
// URL scheme: formiq://
// Universal links: https://formiq.app/share/*
//
// Supported deep links:
//   formiq://workout/{sessionId}     -> /workout/session/{sessionId}
//   formiq://achievement/{id}        -> /(tabs)/progress (with achievement highlight)
//   formiq://share/workout/{id}      -> shared workout summary view
//
// Expo Router handles most of this automatically via the file-based
// routing convention. This file provides helpers for constructing
// shareable URLs and parsing incoming deep links.

import { Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';

const SCHEME = 'formiq';
const WEB_HOST = 'formiq.app';

/** Build a deep link URL for a workout session */
export function buildWorkoutLink(sessionId: string): string {
  return `${SCHEME}://workout/session/${sessionId}`;
}

/** Build a deep link URL for an achievement */
export function buildAchievementLink(achievementId: string): string {
  return `${SCHEME}://progress?achievement=${achievementId}`;
}

/** Build a shareable web URL for a workout */
export function buildShareableWorkoutUrl(sessionId: string): string {
  return `https://${WEB_HOST}/share/workout/${sessionId}`;
}

/** Share a workout summary using the native share sheet */
export async function shareWorkoutSummary(params: {
  sessionId: string;
  title: string;
  summary: string;
}): Promise<boolean> {
  try {
    const url = buildShareableWorkoutUrl(params.sessionId);
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { url, message: `${params.title}\n${params.summary}` }
        : { message: `${params.title}\n${params.summary}\n${url}` },
      { dialogTitle: 'Share Workout' },
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/** Get the initial deep link URL that launched the app (cold start) */
export async function getInitialURL(): Promise<string | null> {
  try {
    return await Linking.getInitialURL();
  } catch {
    return null;
  }
}

/** Subscribe to incoming deep links (warm start) */
export function onDeepLink(callback: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    callback(event.url);
  });
  return () => subscription.remove();
}
