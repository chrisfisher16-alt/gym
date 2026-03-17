import { createServiceClient } from '@/lib/supabase/service';

export interface AuditLogEntry {
  id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogsResult {
  logs: AuditLogEntry[];
  total: number;
}

export async function getAuditLogs(
  page: number = 1,
  pageSize: number = 20,
  actionFilter?: string
): Promise<AuditLogsResult> {
  const sb = createServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from('audit_logs')
    .select('id, action, resource_type, resource_id, details, created_at, admin_users(email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (actionFilter && actionFilter !== 'all') {
    query = query.eq('action', actionFilter);
  }

  const { data, count } = await query;

  return {
    logs: (data ?? []).map((row) => {
      const admin = row.admin_users as unknown as { email: string } | null;
      return {
        id: row.id,
        admin_email: admin?.email ?? 'Unknown',
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        details: row.details as Record<string, unknown> | null,
        created_at: row.created_at,
      };
    }),
    total: count ?? 0,
  };
}

export async function createAuditLog(
  adminUserId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const sb = createServiceClient();
  await sb.from('audit_logs').insert({
    admin_user_id: adminUserId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    details: details ?? null,
  });
}
