// ── Auth Utilities for Edge Functions ────────────────────────────────

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';

export interface AuthResult {
  user_id: string;
  supabase: SupabaseClient;
}

/**
 * Verify the Supabase JWT from the Authorization header and return
 * the authenticated user_id plus a service-role Supabase client.
 */
export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new AuthError('Server configuration error');
  }

  // Create a client with the user's JWT for auth verification
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();

  if (error || !user) {
    throw new AuthError('Invalid or expired token');
  }

  // Create a service-role client for DB operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return { user_id: user.id, supabase };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
