// ── Send Notification Edge Function (Scaffold) ───────────────────
// Server-triggered push notifications via Expo Push API.
// This is a scaffold for future use with server-triggered events.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface SendNotificationRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { supabase } = await verifyAuth(req);

    const body: SendNotificationRequest = await req.json();
    const { user_id, title, body: notifBody, data } = body;

    if (!user_id || !title || !notifBody) {
      return errorResponse('user_id, title, and body are required', 400);
    }

    // Look up push token from notification preferences
    const { data: prefRow, error: prefError } = await supabase
      .from('notification_preferences')
      .select('push_token, quiet_hours_start, quiet_hours_end')
      .eq('user_id', user_id)
      .single();

    if (prefError || !prefRow?.push_token) {
      return errorResponse('No push token found for user', 404);
    }

    // Check quiet hours
    if (prefRow.quiet_hours_start && prefRow.quiet_hours_end) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = (prefRow.quiet_hours_start as string).split(':').map(Number);
      const [endH, endM] = (prefRow.quiet_hours_end as string).split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      let isQuietTime: boolean;
      if (startMinutes <= endMinutes) {
        // e.g., 22:00 to 23:00 (same day)
        isQuietTime = currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // e.g., 22:00 to 07:00 (crosses midnight)
        isQuietTime = currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }

      if (isQuietTime) {
        // Log that we skipped due to quiet hours
        await supabase.from('notification_events').insert({
          user_id,
          type: data?.type ?? 'unknown',
          channel: 'push',
          status: 'failed',
          error: 'Suppressed due to quiet hours',
          created_at: new Date().toISOString(),
        });

        return jsonResponse({
          success: false,
          reason: 'quiet_hours',
          message: 'Notification suppressed due to quiet hours',
        });
      }
    }

    // Send via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: prefRow.push_token,
        title,
        body: notifBody,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
      }),
    });

    const pushResult = await pushResponse.json();

    // Log the notification event
    await supabase.from('notification_events').insert({
      user_id,
      type: data?.type ?? 'unknown',
      channel: 'push',
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      push_result: pushResult,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Send notification error:', error);
    return errorResponse('Failed to send notification', 500);
  }
});
