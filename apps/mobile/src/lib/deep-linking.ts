// ── Deep Linking Configuration ────────────────────────────────────
// URL scheme: health-coach://
// Universal links: https://formiq.app/share/*
//
// Supported deep links:
//   health-coach://workout/{sessionId}     -> /workout/session/{sessionId}
//   health-coach://achievement/{id}        -> /(tabs)/progress (with achievement highlight)
//   health-coach://share/workout/{id}      -> shared workout summary view
//   health-coach://invite/{code}            -> invite redemption flow
//
// Expo Router handles most of this automatically via the file-based
// routing convention. This file provides helpers for constructing
// shareable URLs and parsing incoming deep links.

import { Linking, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from './supabase';
import { crossPlatformAlert } from './cross-platform-alert';
import { useFriendsStore } from '../stores/friends-store';

const SCHEME = 'health-coach';
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

/** Build an invite deep link URL */
export function buildInviteLink(code: string): string {
  return `${SCHEME}://invite/${code}`;
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

/** Build a web (universal) invite link URL */
export function buildInviteWebUrl(code: string): string {
  return `https://${WEB_HOST}/invite/${code}`;
}

/**
 * Handle an incoming invite deep link.
 *
 * Looks up the invite code, validates it, and shows an accept / decline
 * dialog. On accept, redeems the code via the friends store which also
 * triggers a friend-list refresh.
 */
export async function handleInviteLink(code: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { lookupInviteCode } = await import('./share-utils');
  const invite = await lookupInviteCode(code);

  if (!invite) {
    crossPlatformAlert('Invalid Invite', 'This invite link is not valid.');
    return;
  }
  if (invite.isExpired) {
    crossPlatformAlert('Invite Expired', 'This invite link has expired.');
    return;
  }
  if (invite.isRedeemed) {
    crossPlatformAlert('Already Used', 'This invite link has already been used.');
    return;
  }

  crossPlatformAlert(
    'Friend Invite',
    `${invite.inviterName} invited you to connect on FormIQ. Accept?`,
    [
      { text: 'Decline', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          const result = await useFriendsStore.getState().redeemInviteCode(code);
          if (result.success) {
            crossPlatformAlert('Connected!', `You and ${invite.inviterName} are now connected.`);
          } else {
            crossPlatformAlert('Error', result.error ?? 'Failed to accept invite.');
          }
        },
      },
    ],
  );
}

/**
 * Parse a URL and extract the invite code if it matches the invite route.
 * Supports both custom scheme and universal link formats:
 *   health-coach://invite/{code}
 *   https://formiq.app/invite/{code}
 */
export function parseInviteCode(url: string): string | null {
  const schemeMatch = url.match(new RegExp(`^${SCHEME}://invite/([^/?#]+)`));
  if (schemeMatch) return schemeMatch[1];

  const webMatch = url.match(new RegExp(`^https?://${WEB_HOST}/invite/([^/?#]+)`));
  if (webMatch) return webMatch[1];

  return null;
}

/** Subscribe to incoming deep links (warm start) */
export function onDeepLink(callback: (url: string) => void): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    callback(event.url);
  });
  return () => subscription.remove();
}
