import { createServiceClient } from '@/lib/supabase/service';

export interface UserListItem {
  id: string;
  email: string;
  display_name: string | null;
  product_mode: string;
  tier: string | null;
  total_workouts: number;
  total_meals_logged: number;
  total_ai_messages: number;
  signed_up_at: string;
  last_workout_at: string | null;
  last_meal_logged_at: string | null;
  onboarding_completed: boolean;
}

export interface UsersResult {
  users: UserListItem[];
  total: number;
}

export async function getUsers(
  filters?: { tier?: string; search?: string },
  page: number = 1,
  pageSize: number = 20
): Promise<UsersResult> {
  const sb = createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from('user_360_vw')
    .select('*', { count: 'exact' })
    .order('signed_up_at', { ascending: false })
    .range(from, to);

  if (filters?.tier && filters.tier !== 'all') {
    query = query.eq('tier', filters.tier);
  }

  if (filters?.search) {
    query = query.or(`email.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
  }

  const { data, count } = await query;

  return {
    users: (data ?? []).map((row) => ({
      id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      product_mode: row.product_mode,
      tier: row.tier,
      total_workouts: Number(row.total_workouts) || 0,
      total_meals_logged: Number(row.total_meals_logged) || 0,
      total_ai_messages: Number(row.total_ai_messages) || 0,
      signed_up_at: row.signed_up_at,
      last_workout_at: row.last_workout_at,
      last_meal_logged_at: row.last_meal_logged_at,
      onboarding_completed: row.onboarding_completed,
    })),
    total: count ?? 0,
  };
}

export interface UserDetail {
  user_id: string;
  email: string;
  display_name: string | null;
  product_mode: string;
  onboarding_completed: boolean;
  signed_up_at: string;
  tier: string | null;
  is_trial: boolean;
  total_workouts: number;
  total_meals_logged: number;
  total_ai_messages: number;
  active_goals: number;
  last_workout_at: string | null;
  last_meal_logged_at: string | null;
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('user_360_vw')
    .select('*')
    .eq('user_id', id)
    .single();

  if (!data) return null;

  return {
    user_id: data.user_id,
    email: data.email,
    display_name: data.display_name,
    product_mode: data.product_mode,
    onboarding_completed: data.onboarding_completed,
    signed_up_at: data.signed_up_at,
    tier: data.tier,
    is_trial: data.is_trial ?? false,
    total_workouts: Number(data.total_workouts) || 0,
    total_meals_logged: Number(data.total_meals_logged) || 0,
    total_ai_messages: Number(data.total_ai_messages) || 0,
    active_goals: Number(data.active_goals) || 0,
    last_workout_at: data.last_workout_at,
    last_meal_logged_at: data.last_meal_logged_at,
  };
}

export interface ActivityEvent {
  id: string;
  event_name: string;
  event_data: Record<string, unknown> | null;
  screen: string | null;
  created_at: string;
}

export async function getUserActivity(userId: string, limit: number = 20): Promise<ActivityEvent[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('usage_events')
    .select('id, event_name, event_data, screen, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ActivityEvent[];
}

export interface WorkoutSession {
  id: string;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  mood_rating: number | null;
}

export async function getUserWorkouts(userId: string, limit: number = 10): Promise<WorkoutSession[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('workout_sessions')
    .select('id, name, started_at, completed_at, duration_seconds, mood_rating')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as WorkoutSession[];
}

export interface MealLog {
  id: string;
  meal_type: string;
  name: string | null;
  source: string;
  logged_at: string;
}

export async function getUserMeals(userId: string, limit: number = 10): Promise<MealLog[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('meal_logs')
    .select('id, meal_type, name, source, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as MealLog[];
}

export interface CoachMessage {
  id: string;
  role: string;
  content: string | null;
  model: string | null;
  created_at: string;
  conversation_context: string;
}

export async function getUserCoachMessages(userId: string, limit: number = 10): Promise<CoachMessage[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('coach_messages')
    .select('id, role, content, model, created_at, coach_conversations!inner(context)')
    .eq('coach_conversations.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const conv = row.coach_conversations as unknown as { context: string };
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      model: row.model,
      created_at: row.created_at,
      conversation_context: conv?.context ?? 'general',
    };
  });
}

export interface SupportNote {
  id: string;
  content: string;
  created_at: string;
  admin_email: string;
}

export async function getSupportNotes(userId: string): Promise<SupportNote[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('support_notes')
    .select('id, content, created_at, admin_users(email)')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((row) => {
    const admin = row.admin_users as unknown as { email: string } | null;
    return {
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      admin_email: admin?.email ?? 'Unknown',
    };
  });
}

export async function addSupportNote(
  adminUserId: string,
  targetUserId: string,
  content: string
): Promise<void> {
  const sb = createServiceClient();
  await sb.from('support_notes').insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
    content,
  });
}
