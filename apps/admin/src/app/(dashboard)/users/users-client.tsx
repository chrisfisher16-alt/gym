'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/SearchInput';
import { FilterChips } from '@/components/FilterChips';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ExportButton } from '@/components/ExportButton';
import { Pagination } from '@/components/Pagination';
import { downloadExport } from '@/lib/export';
import type { UserListItem } from '@/lib/queries/users';
import styles from './page.module.css';

const TIER_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Workout Coach', value: 'workout_coach' },
  { label: 'Nutrition Coach', value: 'nutrition_coach' },
  { label: 'Full Health Coach', value: 'full_health_coach' },
];

const tierVariant = (tier: string | null) => {
  switch (tier) {
    case 'full_health_coach': return 'primary' as const;
    case 'workout_coach': return 'info' as const;
    case 'nutrition_coach': return 'success' as const;
    default: return 'default' as const;
  }
};

// Use [key: string]: unknown to satisfy DataTable generic constraint
type UserRow = UserListItem & { [key: string]: unknown };

const columns: Column<UserRow>[] = [
  {
    key: 'display_name',
    header: 'User',
    sortable: true,
    render: (row) => <span>{row.display_name || row.email}</span>,
  },
  { key: 'email', header: 'Email', sortable: true },
  {
    key: 'tier',
    header: 'Tier',
    render: (row) => (
      <StatusBadge label={row.tier ?? 'free'} variant={tierVariant(row.tier)} />
    ),
  },
  { key: 'total_workouts', header: 'Workouts', sortable: true },
  { key: 'total_meals_logged', header: 'Meals', sortable: true },
  { key: 'total_ai_messages', header: 'Coach Msgs', sortable: true },
  {
    key: 'signed_up_at',
    header: 'Joined',
    sortable: true,
    render: (row) => <span>{new Date(row.signed_up_at).toLocaleDateString()}</span>,
  },
];

interface UsersClientProps {
  users: UserListItem[];
  total: number;
  currentPage: number;
  currentSearch: string;
  currentTier: string;
}

export function UsersClient({ users, total, currentPage, currentSearch, currentTier }: UsersClientProps) {
  const [search, setSearch] = useState(currentSearch);
  const router = useRouter();

  const handleSearch = (value: string) => {
    setSearch(value);
    const params = new URLSearchParams();
    if (value) params.set('search', value);
    if (currentTier !== 'all') params.set('tier', currentTier);
    router.push(`?${params.toString()}`);
  };

  const handleFilter = (tier: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tier !== 'all') params.set('tier', tier);
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name or email..."
        />
        <FilterChips options={TIER_FILTERS} selected={currentTier} onChange={handleFilter} />
        <ExportButton onClick={() => downloadExport('users')} />
      </div>

      <DataTable
        columns={columns}
        data={users as UserRow[]}
        onRowClick={(row) => router.push(`/users/${row.id}`)}
      />

      <Pagination total={total} pageSize={20} currentPage={currentPage} />
    </>
  );
}
