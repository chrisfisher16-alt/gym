export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/PageHeader';
import { getAuditLogs } from '@/lib/queries/audit';
import { AuditClient } from './audit-client';

interface Props {
  searchParams: Promise<{ page?: string; action?: string }>;
}

export default async function AuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { logs, total } = await getAuditLogs(page, 20, params.action);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track all admin actions"
      />
      <AuditClient
        logs={logs}
        total={total}
        currentPage={page}
        currentAction={params.action ?? 'all'}
      />
    </div>
  );
}
