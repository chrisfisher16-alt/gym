import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service_role key.
 * This bypasses RLS — use only in server-side admin code.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
