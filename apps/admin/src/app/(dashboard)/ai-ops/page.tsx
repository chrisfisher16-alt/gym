'use client';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

interface ErrorRow {
  id: string;
  time: string;
  model: string;
  context: string;
  error: string;
  userId: string;
  [key: string]: unknown;
}

const latencyData = [
  { name: '00:00', p50: 320, p95: 890, p99: 1400 },
  { name: '04:00', p50: 290, p95: 750, p99: 1200 },
  { name: '08:00', p50: 380, p95: 920, p99: 1600 },
  { name: '12:00', p50: 420, p95: 1050, p99: 1800 },
  { name: '16:00', p50: 450, p95: 1100, p99: 1900 },
  { name: '20:00', p50: 390, p95: 950, p99: 1500 },
];

const recentErrors: ErrorRow[] = [
  { id: '1', time: '10 min ago', model: 'gpt-4o', context: 'workout', error: 'Rate limit exceeded', userId: 'u42' },
  { id: '2', time: '45 min ago', model: 'gpt-4o', context: 'nutrition', error: 'Context length exceeded', userId: 'u78' },
  { id: '3', time: '2 hours ago', model: 'gpt-4o-mini', context: 'general', error: 'Timeout (30s)', userId: 'u15' },
  { id: '4', time: '3 hours ago', model: 'gpt-4o', context: 'progress', error: 'Invalid response format', userId: 'u91' },
  { id: '5', time: '5 hours ago', model: 'gpt-4o-mini', context: 'onboarding', error: 'Rate limit exceeded', userId: 'u33' },
];

const errorColumns: Column<ErrorRow>[] = [
  { key: 'time', header: 'Time' },
  { key: 'model', header: 'Model' },
  { key: 'context', header: 'Context', render: (row) => <StatusBadge label={row.context} variant="default" /> },
  { key: 'error', header: 'Error', render: (row) => <span style={{ color: 'var(--color-danger)' }}>{row.error}</span> },
  { key: 'userId', header: 'User ID' },
];

export default function AIOpsPage() {
  return (
    <div>
      <PageHeader
        title="AI Ops"
        description="AI model performance and cost monitoring"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="Messages (Today)" value="12,450" trend={{ value: 15, direction: 'up' }} subtitle="vs yesterday" />
        <KPICard label="Token Usage (Today)" value="4.2M" trend={{ value: 12, direction: 'up' }} subtitle="input + output" />
        <KPICard label="Cost Estimate (MTD)" value="$2,140" trend={{ value: 18, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="Error Rate" value="0.3%" trend={{ value: 0.1, direction: 'down' }} subtitle="improved" />
      </div>

      <div className={styles.chartRow}>
        <Chart
          title="Response Latency"
          subtitle="Percentiles over 24h (ms)"
          type="line"
          data={latencyData}
          dataKeys={[
            { key: 'p50', name: 'P50', color: '#059669' },
            { key: 'p95', name: 'P95', color: '#d97706' },
            { key: 'p99', name: 'P99', color: '#dc2626' },
          ]}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Recent Errors</h3>
        <DataTable columns={errorColumns} data={recentErrors} />
      </div>
    </div>
  );
}
