import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { updateFeedbackStatus } from '@/lib/queries/feedback';
import { logAdminAction } from '@/lib/admin-auth';

const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'closed', 'wont_fix'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { id, status, admin_notes, priority, assigned_to } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` }, { status: 400 });
    }

    const success = await updateFeedbackStatus(id, status, admin_notes, priority, assigned_to);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    // Log admin action
    await logAdminAction(adminUser.id, 'feedback.update', 'feedback', id, {
      status,
      priority,
      has_notes: !!admin_notes,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Feedback update API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
