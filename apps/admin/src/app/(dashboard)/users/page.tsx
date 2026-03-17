export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/PageHeader';
import { getUsers } from '@/lib/queries/users';
import { UsersClient } from './users-client';

interface Props {
  searchParams: Promise<{ search?: string; tier?: string; page?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { users, total } = await getUsers(
    { tier: params.tier, search: params.search },
    page,
    20
  );

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${total} total users`}
      />
      <UsersClient
        users={users}
        total={total}
        currentPage={page}
        currentSearch={params.search ?? ''}
        currentTier={params.tier ?? 'all'}
      />
    </div>
  );
}
