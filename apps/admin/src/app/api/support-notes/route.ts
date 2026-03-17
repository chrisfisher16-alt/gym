import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { addSupportNote } from '@/lib/queries/users';
import { logAdminAction } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
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
  const { userId, content } = body;

  if (!userId || !content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await addSupportNote(adminUser.id, userId, content);
  await logAdminAction(adminUser.id, 'support.note_added', 'user', userId, { content });

  return NextResponse.json({ success: true });
}
