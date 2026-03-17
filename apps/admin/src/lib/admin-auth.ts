import { type SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  user_id: string;
  role_id: string;
  email: string;
  display_name: string | null;
  role: {
    id: string;
    name: string;
    permissions: string[];
  } | null;
}

/**
 * Get the current admin user from the session.
 * Uses the server Supabase client (session-based) to get auth user,
 * then service client to read admin_users (which has no user-facing RLS policies).
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: adminUser } = await service
    .from('admin_users')
    .select('id, user_id, role_id, email, display_name, admin_roles(id, name, permissions)')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) return null;

  const role = adminUser.admin_roles as unknown as AdminUser['role'];
  return {
    id: adminUser.id,
    user_id: adminUser.user_id,
    role_id: adminUser.role_id,
    email: adminUser.email,
    display_name: adminUser.display_name,
    role,
  };
}

/**
 * Require an admin user — throws redirect-worthy error if not found.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error('Unauthorized: admin access required');
  }
  return admin;
}

/**
 * Check if admin has a specific permission.
 */
export async function requirePermission(permission: string): Promise<AdminUser> {
  const admin = await requireAdmin();
  const permissions = admin.role?.permissions ?? [];
  if (!permissions.includes(permission) && !permissions.includes('*')) {
    throw new Error(`Forbidden: missing permission '${permission}'`);
  }
  return admin;
}

/**
 * Log an admin action to the audit_logs table.
 */
export async function logAdminAction(
  adminUserId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const service = createServiceClient();
  await service.from('audit_logs').insert({
    admin_user_id: adminUserId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    details: details ?? null,
  });
}
