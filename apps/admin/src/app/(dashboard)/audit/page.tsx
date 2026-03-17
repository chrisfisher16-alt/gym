'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterChips } from '@/components/FilterChips';
import { PageHeader } from '@/components/PageHeader';
import { ExportButton } from '@/components/ExportButton';
import styles from './page.module.css';

interface AuditRow {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  resource: string;
  details: string;
  [key: string]: unknown;
}

const AUDIT_LOGS: AuditRow[] = [
  { id: '1', timestamp: '2025-03-15 14:32:10', admin: 'admin@example.com', action: 'user.update', resource: 'User u42', details: 'Updated subscription tier' },
  { id: '2', timestamp: '2025-03-15 13:15:22', admin: 'admin@example.com', action: 'config.update', resource: 'Feature Flag: photo_meal_logging', details: 'Rollout changed from 25% to 50%' },
  { id: '3', timestamp: '2025-03-15 11:08:45', admin: 'support@example.com', action: 'user.view', resource: 'User u78', details: 'Viewed user profile' },
  { id: '4', timestamp: '2025-03-14 16:42:33', admin: 'admin@example.com', action: 'notification.send', resource: 'Batch notification', details: 'Sent promo to 2,400 users' },
  { id: '5', timestamp: '2025-03-14 10:20:15', admin: 'admin@example.com', action: 'user.delete', resource: 'User u99', details: 'Account deletion request' },
  { id: '6', timestamp: '2025-03-13 09:55:40', admin: 'support@example.com', action: 'user.update', resource: 'User u15', details: 'Reset password' },
  { id: '7', timestamp: '2025-03-13 08:30:12', admin: 'admin@example.com', action: 'config.update', resource: 'Pricing: Full Health Coach', details: 'Price updated from $24.99 to $29.99' },
  { id: '8', timestamp: '2025-03-12 15:18:30', admin: 'admin@example.com', action: 'auth.login', resource: 'Admin portal', details: 'Successful login' },
];

const ACTION_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'User Updates', value: 'user.update' },
  { label: 'User Views', value: 'user.view' },
  { label: 'User Deletes', value: 'user.delete' },
  { label: 'Config Changes', value: 'config.update' },
  { label: 'Notifications', value: 'notification.send' },
  { label: 'Auth', value: 'auth.login' },
];

const actionVariant = (action: string) => {
  if (action.startsWith('user.update')) return 'info' as const;
  if (action.startsWith('user.delete')) return 'danger' as const;
  if (action.startsWith('config')) return 'warning' as const;
  if (action.startsWith('notification')) return 'primary' as const;
  if (action.startsWith('auth')) return 'success' as const;
  return 'default' as const;
};

const columns: Column<AuditRow>[] = [
  { key: 'timestamp', header: 'Timestamp', sortable: true },
  { key: 'admin', header: 'Admin' },
  {
    key: 'action',
    header: 'Action',
    render: (row) => <StatusBadge label={row.action} variant={actionVariant(row.action)} />,
  },
  { key: 'resource', header: 'Resource' },
  { key: 'details', header: 'Details' },
];

export default function AuditPage() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? AUDIT_LOGS
    : AUDIT_LOGS.filter((log) => log.action === filter);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track all admin actions"
        actions={<ExportButton />}
      />

      <div className={styles.filterRow}>
        <FilterChips options={ACTION_FILTERS} selected={filter} onChange={setFilter} />
      </div>

      <DataTable columns={columns} data={filtered} />
    </div>
  );
}
