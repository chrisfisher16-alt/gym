// ── Auth Utilities for Edge Functions ────────────────────────────────

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';

export interface AuthResult {
  user_id: string;
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseClient;
}

/**
 * Verify the Supabase JWT from the Authorization header and return
 * the authenticated user_id, a user-scoped client (RLS-safe), and
 * a service-role admin client.
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    throw new AuthError('Server configuration error');
  }

  // User-scoped client — respects RLS using the caller's JWT
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Invalid or expired token');
  }

  // Service-role client — bypasses RLS for admin operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  return { user_id: user.id, supabase, supabaseAdmin };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
