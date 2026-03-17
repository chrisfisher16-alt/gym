'use client';

import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterChips } from '@/components/FilterChips';
import { ExportButton } from '@/components/ExportButton';
import { Pagination } from '@/components/Pagination';
import { downloadExport } from '@/lib/export';
import type { SubscriptionEvent } from '@/lib/queries/revenue';
import styles from './page.module.css';

const EVENT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Subscription Created', value: 'subscription_created' },
  { label: 'Renewal', value: 'renewal' },
  { label: 'Upgrade', value: 'upgrade' },
  { label: 'Downgrade', value: 'downgrade' },
  { label: 'Cancellation', value: 'cancellation' },
];

const eventVariant = (event: string) => {
  if (event.includes('upgrade')) return 'success' as const;
  if (event.includes('renew')) return 'info' as const;
  if (event.includes('cancel')) return 'danger' as const;
  if (event.includes('downgrade')) return 'warning' as const;
  if (event.includes('create')) return 'primary' as const;
  return 'default' as const;
};

type EventRow = SubscriptionEvent & { [key: string]: unknown };

const columns: Column<EventRow>[] = [
  { key: 'user_email', header: 'User', sortable: true },
  {
    key: 'event_type',
    header: 'Event',
    render: (row) => <StatusBadge label={row.event_type} variant={eventVariant(row.event_type)} />,
  },
  { key: 'previous_plan_id', header: 'From' },
  { key: 'plan_id', header: 'To' },
  {
    key: 'revenue_usd',
    header: 'Revenue',
    sortable: true,
    render: (row) => <span>${row.revenue_usd.toFixed(2)}</span>,
  },
  {
    key: 'created_at',
    header: 'Date',
    sortable: true,
    render: (row) => <span>{new Date(row.created_at).toLocaleDateString()}</span>,
  },
];

interface RevenueClientProps {
  events: SubscriptionEvent[];
  total: number;
  currentPage: number;
  currentEventType: string;
}

export function RevenueClient({ events, total, currentPage, currentEventType }: RevenueClientProps) {
  const router = useRouter();

  const handleFilter = (type: string) => {
    const params = new URLSearchParams();
    if (type !== 'all') params.set('eventType', type);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className={styles.tableSection}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className={styles.tableTitle}>Subscription Events</h3>
        <ExportButton onClick={() => downloadExport('subscriptions')} />
      </div>
      <FilterChips options={EVENT_FILTERS} selected={currentEventType} onChange={handleFilter} />
      <DataTable columns={columns} data={events as EventRow[]} />
      <Pagination total={total} pageSize={20} currentPage={currentPage} />
    </div>
  );
}
