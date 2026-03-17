'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { FilterChips } from '@/components/FilterChips';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ExportButton } from '@/components/ExportButton';
import styles from './page.module.css';

interface UserRow {
  id: string;
  name: string;
  email: string;
  tier: string;
  productMode: string;
  lastActive: string;
  workouts: number;
  meals: number;
  coachMessages: number;
  joined: string;
  [key: string]: unknown;
}

const DEMO_USERS: UserRow[] = [
  { id: 'u1', name: 'Sarah Chen', email: 'sarah@example.com', tier: 'full_health_coach', productMode: 'Full Health Coach', lastActive: '2 hours ago', workouts: 48, meals: 156, coachMessages: 89, joined: '2024-11-15' },
  { id: 'u2', name: 'Mike Johnson', email: 'mike@example.com', tier: 'workout_coach', productMode: 'Workout Coach', lastActive: '1 day ago', workouts: 92, meals: 12, coachMessages: 34, joined: '2024-10-22' },
  { id: 'u3', name: 'Emily Davis', email: 'emily@example.com', tier: 'nutrition_coach', productMode: 'Nutrition Coach', lastActive: '3 hours ago', workouts: 5, meals: 230, coachMessages: 67, joined: '2024-12-01' },
  { id: 'u4', name: 'James Wilson', email: 'james@example.com', tier: 'free', productMode: 'Free', lastActive: '5 days ago', workouts: 8, meals: 15, coachMessages: 3, joined: '2025-01-10' },
  { id: 'u5', name: 'Anna Martinez', email: 'anna@example.com', tier: 'full_health_coach', productMode: 'Full Health Coach', lastActive: '30 min ago', workouts: 120, meals: 340, coachMessages: 156, joined: '2024-09-05' },
  { id: 'u6', name: 'Tom Baker', email: 'tom@example.com', tier: 'workout_coach', productMode: 'Workout Coach', lastActive: '12 hours ago', workouts: 65, meals: 8, coachMessages: 21, joined: '2024-11-28' },
  { id: 'u7', name: 'Lisa Park', email: 'lisa@example.com', tier: 'free', productMode: 'Free', lastActive: '2 weeks ago', workouts: 2, meals: 4, coachMessages: 1, joined: '2025-02-14' },
  { id: 'u8', name: 'David Kim', email: 'david@example.com', tier: 'nutrition_coach', productMode: 'Nutrition Coach', lastActive: '6 hours ago', workouts: 15, meals: 180, coachMessages: 45, joined: '2024-12-20' },
];

const TIER_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Workout Coach', value: 'workout_coach' },
  { label: 'Nutrition Coach', value: 'nutrition_coach' },
  { label: 'Full Health Coach', value: 'full_health_coach' },
];

const tierVariant = (tier: string) => {
  switch (tier) {
    case 'full_health_coach': return 'primary' as const;
    case 'workout_coach': return 'info' as const;
    case 'nutrition_coach': return 'success' as const;
    default: return 'default' as const;
  }
};

const columns: Column<UserRow>[] = [
  { key: 'name', header: 'User', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  {
    key: 'tier',
    header: 'Tier',
    render: (row) => (
      <StatusBadge label={row.productMode} variant={tierVariant(row.tier)} />
    ),
  },
  { key: 'lastActive', header: 'Last Active' },
  { key: 'workouts', header: 'Workouts', sortable: true },
  { key: 'meals', header: 'Meals', sortable: true },
  { key: 'coachMessages', header: 'Coach Msgs', sortable: true },
  { key: 'joined', header: 'Joined', sortable: true },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const router = useRouter();

  const filtered = DEMO_USERS.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || u.tier === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${DEMO_USERS.length} total users`}
        actions={<ExportButton />}
      />

      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, or user ID..."
        />
        <FilterChips options={TIER_FILTERS} selected={filter} onChange={setFilter} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/users/${row.id}`)}
      />
    </div>
  );
}
