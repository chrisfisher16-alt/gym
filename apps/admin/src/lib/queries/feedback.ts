import { createServiceClient } from '@/lib/supabase/service';

export interface FeedbackRow {
  id: string;
  user_id: string;
  category: string;
  status: string;
  priority: string | null;
  description: string;
  screenshot_url: string | null;
  screen_context: string | null;
  app_version: string | null;
  device_info: string | null;
  os_name: string | null;
  os_version: string | null;
  theme: string | null;
  network_status: string | null;
  account_age_days: number | null;
  workout_count: number | null;
  subscription_tier: string | null;
  admin_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  user_email?: string;
  display_name?: string;
}

export interface FeedbackKPIs {
  totalFeedback: number;
  openCount: number;
  bugCount: number;
  featureRequestCount: number;
  aiAccuracyCount: number;
  avgResponseTime: number | null;
  todayCount: number;
  weekCount: number;
}

export async function getFeedbackKPIs(): Promise<FeedbackKPIs> {
  const sb = createServiceClient();

  const [
    { count: totalFeedback },
    { count: openCount },
    { count: bugCount },
    { count: featureRequestCount },
    { count: aiAccuracyCount },
    { count: todayCount },
    { count: weekCount },
  ] = await Promise.all([
    sb.from('feedback').select('id', { count: 'exact', head: true }),
    sb.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('feedback').select('id', { count: 'exact', head: true }).eq('category', 'bug'),
    sb.from('feedback').select('id', { count: 'exact', head: true }).eq('category', 'feature_request'),
    sb.from('feedback').select('id', { count: 'exact', head: true }).eq('category', 'ai_accuracy'),
    sb.from('feedback').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    sb.from('feedback').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  return {
    totalFeedback: totalFeedback ?? 0,
    openCount: openCount ?? 0,
    bugCount: bugCount ?? 0,
    featureRequestCount: featureRequestCount ?? 0,
    aiAccuracyCount: aiAccuracyCount ?? 0,
    avgResponseTime: null,
    todayCount: todayCount ?? 0,
    weekCount: weekCount ?? 0,
  };
}

export async function getFeedbackList(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    category?: string;
    status?: string;
    priority?: string;
    search?: string;
  },
): Promise<{ items: FeedbackRow[]; total: number }> {
  const sb = createServiceClient();

  let query = sb
    .from('feedback')
    .select('*', { count: 'exact' });

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }
  if (filters?.search) {
    query = query.ilike('description', `%${filters.search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Feedback query error:', error);
    return { items: [], total: 0 };
  }

  return {
    items: (data ?? []) as FeedbackRow[],
    total: count ?? 0,
  };
}

export async function getFeedbackById(id: string): Promise<FeedbackRow | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('feedback')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as FeedbackRow;
}

export async function updateFeedbackStatus(
  id: string,
  status: string,
  adminNotes?: string,
  priority?: string,
  assignedTo?: string,
): Promise<boolean> {
  const sb = createServiceClient();

  const update: Record<string, unknown> = { status };
  if (adminNotes !== undefined) update.admin_notes = adminNotes;
  if (priority !== undefined) update.priority = priority;
  if (assignedTo !== undefined) update.assigned_to = assignedTo;

  const { error } = await sb
    .from('feedback')
    .update(update)
    .eq('id', id);

  return !error;
}

export async function getCategoryBreakdown(): Promise<{ category: string; count: number }[]> {
  const sb = createServiceClient();
  const categories = ['bug', 'feature_request', 'general', 'ai_accuracy'];

  const results = await Promise.all(
    categories.map(async (cat) => {
      const { count } = await sb
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat);
      return { category: cat, count: count ?? 0 };
    }),
  );

  return results;
}
