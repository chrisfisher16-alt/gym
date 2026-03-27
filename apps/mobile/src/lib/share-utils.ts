import { Share, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { useAuthStore } from '../stores/auth-store';

const INVITE_BASE_URL = 'https://formiq.app/invite';

/**
 * Generate a unique invite link for the current user.
 * Creates a record in invite_links table and returns the shareable URL.
 */
export async function generateInviteLink(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return null;

  // Generate a short random code
  const code = generateCode(8);
  
  const { error } = await supabase
    .from('invite_links')
    .insert({
      inviter_id: userId,
      code,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    });

  if (error) {
    console.warn('[ShareUtils] Failed to create invite link:', error.message);
    return null;
  }

  return `${INVITE_BASE_URL}/${code}`;
}

/**
 * Generate a random alphanumeric code.
 */
function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get the share message for an invite link.
 */
export function getInviteShareMessage(inviteLink: string): string {
  return `Hey! I'm using FormIQ to track my workouts — let's compete! 💪\nJoin me: ${inviteLink}`;
}

/**
 * Open the native share sheet with an invite link.
 */
export async function shareInviteLink(): Promise<boolean> {
  const link = await generateInviteLink();
  if (!link) return false;

  try {
    const message = getInviteShareMessage(link);
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message, url: link }
        : { message }
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * Look up an invite code and return the inviter's info.
 */
export async function lookupInviteCode(code: string): Promise<{
  inviterId: string;
  inviterName: string;
  isExpired: boolean;
  isRedeemed: boolean;
} | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('invite_links')
    .select('inviter_id, expires_at, redeemed_by, profiles!inviter_id(display_name)')
    .eq('code', code)
    .single();

  if (error || !data) return null;

  const profile = data.profiles as unknown as { display_name: string } | null;

  return {
    inviterId: data.inviter_id,
    inviterName: profile?.display_name ?? 'Someone',
    isExpired: data.expires_at ? new Date(data.expires_at) < new Date() : false,
    isRedeemed: !!data.redeemed_by,
  };
}

/**
 * Redeem an invite code — marks it as used and sends a friend request.
 */
export async function redeemInviteCode(code: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not connected' };

  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { success: false, error: 'Not signed in' };

  const invite = await lookupInviteCode(code);
  if (!invite) return { success: false, error: 'Invalid invite code' };
  if (invite.isExpired) return { success: false, error: 'Invite has expired' };
  if (invite.isRedeemed) return { success: false, error: 'Invite already used' };
  if (invite.inviterId === userId) return { success: false, error: 'Cannot use your own invite' };

  // Mark invite as redeemed
  await supabase
    .from('invite_links')
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq('code', code);

  // Send friend request (or auto-accept)
  const { error } = await supabase
    .from('friendships')
    .insert({
      user_id: invite.inviterId,
      friend_id: userId,
      status: 'accepted', // Auto-accept since they came via invite
      invited_by: invite.inviterId,
    });

  if (error) {
    // May already be friends
    if (error.code === '23505') return { success: true }; // unique violation = already friends
    console.warn('[ShareUtils] Failed to create friendship:', error.message);
    return { success: false, error: 'Failed to connect' };
  }

  return { success: true };
}
