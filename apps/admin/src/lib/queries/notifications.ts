import { createServiceClient } from '@/lib/supabase/service';
import { subDays } from 'date-fns';

export interface NotificationMetrics {
  optInRate: number;
  scheduledCount: number;
  overallOpenRate: number;
}

export async function getNotificationMetrics(): Promise<NotificationMetrics> {
  const sb = createServiceClient();

  // Total users with push token
  const { count: withToken } = await sb
    .from('notification_preferences')
    .select('id', { count: 'exact', head: true })
    .not('push_token', 'is', null);

  const { count: totalPrefs } = await sb
    .from('notification_preferences')
    .select('id', { count: 'exact', head: true });

  // Scheduled pending notifications
  const { count: scheduled } = await sb
    .from('notification_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Open rate (sent vs opened in last 7d)
  const d7 = subDays(new Date(), 7).toISOString();
  const { count: sent } = await sb
    .from('notification_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', d7);

  const { count: opened } = await sb
    .from('notification_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'opened')
    .gte('created_at', d7);

  const total = totalPrefs ?? 1;
  const sentTotal = (sent ?? 0) + (opened ?? 0);

  return {
    optInRate: total > 0 ? Math.round(((withToken ?? 0) / total) * 100) : 0,
    scheduledCount: scheduled ?? 0,
    overallOpenRate: sentTotal > 0 ? Math.round(((opened ?? 0) / sentTotal) * 100) : 0,
  };
}

export interface ReminderPerformance {
  type: string;
  sent: number;
  opened: number;
  rate: string;
}

export async function getReminderPerformance(): Promise<ReminderPerformance[]> {
  const sb = createServiceClient();
  const d7 = subDays(new Date(), 7).toISOString();

  const { data } = await sb
    .from('notification_events')
    .select('type, status')
    .gte('created_at', d7);

  const byType: Record<string, { sent: number; opened: number }> = {};
  for (const row of data ?? []) {
    if (!byType[row.type]) byType[row.type] = { sent: 0, opened: 0 };
    if (row.status === 'sent' || row.status === 'opened') {
      byType[row.type].sent += 1;
    }
    if (row.status === 'opened') {
      byType[row.type].opened += 1;
    }
  }

  return Object.entries(byType).map(([type, stats]) => ({
    type,
    sent: stats.sent,
    opened: stats.opened,
    rate: stats.sent > 0 ? `${Math.round((stats.opened / stats.sent) * 100)}%` : '0%',
  }));
}
