'use client';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { ExportButton } from '@/components/ExportButton';
import styles from './page.module.css';

interface SubEvent {
  id: string;
  user: string;
  event: string;
  fromTier: string;
  toTier: string;
  revenue: string;
  date: string;
  [key: string]: unknown;
}

const planMixData = [
  { name: 'Free', value: 8400 },
  { name: 'Workout Coach', value: 2100 },
  { name: 'Nutrition Coach', value: 1400 },
  { name: 'Full Health Coach', value: 1300 },
];

const subEvents: SubEvent[] = [
  { id: '1', user: 'sarah@example.com', event: 'upgraded', fromTier: 'Workout Coach', toTier: 'Full Health Coach', revenue: '$29.99', date: '2025-03-15' },
  { id: '2', user: 'mike@example.com', event: 'renewed', fromTier: 'Workout Coach', toTier: 'Workout Coach', revenue: '$14.99', date: '2025-03-15' },
  { id: '3', user: 'emma@example.com', event: 'cancelled', fromTier: 'Full Health Coach', toTier: 'Free', revenue: '$0', date: '2025-03-14' },
  { id: '4', user: 'john@example.com', event: 'started', fromTier: 'Free', toTier: 'Nutrition Coach', revenue: '$14.99', date: '2025-03-14' },
  { id: '5', user: 'lisa@example.com', event: 'downgraded', fromTier: 'Full Health Coach', toTier: 'Workout Coach', revenue: '$14.99', date: '2025-03-13' },
  { id: '6', user: 'alex@example.com', event: 'renewed', fromTier: 'Full Health Coach', toTier: 'Full Health Coach', revenue: '$29.99', date: '2025-03-13' },
];

const eventVariant = (event: string) => {
  switch (event) {
    case 'upgraded': return 'success' as const;
    case 'renewed': return 'info' as const;
    case 'cancelled': return 'danger' as const;
    case 'downgraded': return 'warning' as const;
    case 'started': return 'primary' as const;
    default: return 'default' as const;
  }
};

const columns: Column<SubEvent>[] = [
  { key: 'user', header: 'User', sortable: true },
  {
    key: 'event',
    header: 'Event',
    render: (row) => <StatusBadge label={row.event} variant={eventVariant(row.event)} />,
  },
  { key: 'fromTier', header: 'From' },
  { key: 'toTier', header: 'To' },
  { key: 'revenue', header: 'Revenue', sortable: true },
  { key: 'date', header: 'Date', sortable: true },
];

export default function RevenuePage() {
  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Subscription revenue and plan analytics"
        actions={<ExportButton />}
      />

      <div className={styles.kpiGrid}>
        <KPICard label="MRR" value="$42,000" trend={{ value: 10, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="Active Subscriptions" value="4,800" trend={{ value: 5, direction: 'up' }} />
        <KPICard label="Workout Coach" value="2,100" subtitle="active subs" />
        <KPICard label="Nutrition Coach" value="1,400" subtitle="active subs" />
        <KPICard label="Full Health Coach" value="1,300" subtitle="active subs" />
      </div>

      <div className={styles.chartRow}>
        <Chart
          title="Plan Mix"
          subtitle="Active subscribers by tier"
          type="pie"
          data={planMixData}
          dataKeys={[{ key: 'value' }]}
        />
      </div>

      <div className={styles.tableSection}>
        <h3 className={styles.tableTitle}>Recent Subscription Events</h3>
        <DataTable columns={columns} data={subEvents} />
      </div>
    </div>
  );
}
