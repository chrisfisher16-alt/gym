// ── Delete Account Edge Function ─────────────────────────────────
// Permanently deletes all user data and the auth account.
// Called from the mobile app after user confirms deletion.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { verifyAuth, AuthError } from '../_shared/auth.ts';

// Tables that contain user data, ordered to respect FK constraints.
// Child/dependent tables come first, then parent tables.
const USER_TABLES = [
  // Social / feed
  { table: 'social_likes', column: 'user_id' },
  { table: 'social_feed', column: 'user_id' },
  { table: 'follows', column: 'follower_id' },
  { table: 'follows', column: 'following_id' },
  { table: 'friendships', column: 'requester_id' },
  { table: 'friendships', column: 'addressee_id' },

  // Workout data (child tables first)
  { table: 'set_logs', column: 'user_id' },
  { table: 'workout_sessions', column: 'user_id' },
  { table: 'workout_days', column: 'program_id', via: 'workout_programs' },
  { table: 'workout_programs', column: 'user_id' },

  // Nutrition
  { table: 'meal_items', column: 'user_id' },
  { table: 'meal_logs', column: 'user_id' },
  { table: 'saved_meals', column: 'user_id' },
  { table: 'nutrition_day_logs', column: 'user_id' },

  // Body / measurements
  { table: 'body_measurements', column: 'user_id' },
  { table: 'user_supplements', column: 'user_id' },

  // Coach / AI
  { table: 'coach_messages', column: 'user_id' },
  { table: 'coach_conversations', column: 'user_id' },
  { table: 'coach_memory_summaries', column: 'user_id' },
  { table: 'coach_preferences', column: 'user_id' },
  { table: 'ai_usage_events', column: 'user_id' },

  // Goals
  { table: 'goals', column: 'user_id' },

  // Notifications
  { table: 'notification_events', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'push_tokens', column: 'user_id' },

  // Subscription / billing
  { table: 'subscription_events', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
  { table: 'entitlements', column: 'user_id' },

  // Feedback & usage
  { table: 'feedback', column: 'user_id' },
  { table: 'usage_events', column: 'user_id' },

  // Profile (last — other tables may FK to it)
  { table: 'profiles', column: 'id' },
];

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user_id, supabase } = await verifyAuth(req);

    const errors: string[] = [];

    // Delete user data from all tables
    for (const { table, column, via } of USER_TABLES) {
      try {
        if (via) {
          // Indirect relationship — e.g. workout_days via workout_programs
          const { data: parentRows } = await supabase
            .from(via)
            .select('id')
            .eq('user_id', user_id);

          if (parentRows && parentRows.length > 0) {
            const parentIds = parentRows.map((r: { id: string }) => r.id);
            await supabase.from(table).delete().in(column, parentIds);
          }
        } else {
          await supabase.from(table).delete().eq(column, user_id);
        }
      } catch (e) {
        // Log but continue — table may not exist in all environments
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`Failed to delete from ${table}: ${msg}`);
        errors.push(`${table}: ${msg}`);
      }
    }

    // Delete the auth user via admin API
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return errorResponse('Failed to delete account. Please contact support.', 500);
    }

    return jsonResponse({
      success: true,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, 401);
    }
    console.error('Delete account error:', error);
    return errorResponse('Failed to delete account', 500);
  }
});
