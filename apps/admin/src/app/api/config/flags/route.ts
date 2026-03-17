import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { updateFeatureFlag } from '@/lib/queries/config';

export async function PATCH(request: NextRequest) {
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

  const body = await request.json();
  const { flagId, is_enabled, rollout_percentage } = body;

  if (!flagId) {
    return NextResponse.json({ error: 'Missing flagId' }, { status: 400 });
  }

  const updates: { is_enabled?: boolean; rollout_percentage?: number } = {};
  if (typeof is_enabled === 'boolean') updates.is_enabled = is_enabled;
  if (typeof rollout_percentage === 'number') updates.rollout_percentage = rollout_percentage;

  await updateFeatureFlag(adminUser.id, flagId, updates);

  return NextResponse.json({ success: true });
}
