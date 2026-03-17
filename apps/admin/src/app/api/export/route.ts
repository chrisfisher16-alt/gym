import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? '' : String(val);
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  // Verify admin auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: adminUser } = await service
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type');

  let rows: Record<string, unknown>[] = [];
  let filename = 'export';

  switch (type) {
    case 'users': {
      const { data } = await service
        .from('user_360_vw')
        .select('user_id, email, display_name, product_mode, tier, total_workouts, total_meals_logged, total_ai_messages, signed_up_at')
        .order('signed_up_at', { ascending: false })
        .limit(10000);
      rows = (data ?? []) as Record<string, unknown>[];
      filename = 'users_export';
      break;
    }
    case 'subscriptions': {
      const { data } = await service
        .from('subscription_events')
        .select('id, user_id, event_type, plan_id, previous_plan_id, revenue_usd, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      rows = (data ?? []) as Record<string, unknown>[];
      filename = 'subscription_events_export';
      break;
    }
    case 'usage': {
      const { data } = await service
        .from('usage_events')
        .select('id, user_id, event_name, screen, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      rows = (data ?? []) as Record<string, unknown>[];
      filename = 'usage_events_export';
      break;
    }
    case 'ai_events': {
      const { data } = await service
        .from('ai_usage_events')
        .select('id, user_id, model, input_tokens, output_tokens, total_tokens, estimated_cost_usd, latency_ms, status, error, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      rows = (data ?? []) as Record<string, unknown>[];
      filename = 'ai_events_export';
      break;
    }
    case 'audit': {
      const { data } = await service
        .from('audit_logs')
        .select('id, admin_user_id, action, resource_type, resource_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      rows = (data ?? []) as Record<string, unknown>[];
      filename = 'audit_logs_export';
      break;
    }
    default:
      return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }

  // Log the export action
  await service.from('audit_logs').insert({
    admin_user_id: adminUser.id,
    action: 'data.export',
    resource_type: type,
    details: { row_count: rows.length },
  });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  });
}
