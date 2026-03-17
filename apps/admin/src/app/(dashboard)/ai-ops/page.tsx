export const dynamic = 'force-dynamic';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import {
  getAIMetrics, getAILatencyTrend, getAIErrors,
  getFlaggedConversations, getModelUsage,
} from '@/lib/queries/ai-ops';
import styles from './page.module.css';

type ErrorRow = {
  id: string;
  user_id: string;
  model: string;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
  [key: string]: unknown;
};

const errorColumns: Column<ErrorRow>[] = [
  {
    key: 'created_at',
    header: 'Time',
    render: (row) => <span>{new Date(row.created_at).toLocaleString()}</span>,
  },
  { key: 'model', header: 'Model' },
  {
    key: 'error',
    header: 'Error',
    render: (row) => <span style={{ color: 'var(--color-danger)' }}>{row.error || 'Unknown'}</span>,
  },
  { key: 'user_id', header: 'User ID' },
];

export default async function AIOpsPage() {
  const [metrics, latency, errors, flagged, modelUsage] = await Promise.all([
    getAIMetrics(),
    getAILatencyTrend(7),
    getAIErrors(1, 10),
    getFlaggedConversations(),
    getModelUsage(),
  ]);

  const latencyChart = latency.map((p) => ({ name: p.name, avgLatency: p.avgLatency }));

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div>
      <PageHeader
        title="AI Ops"
        description="AI model performance and cost monitoring"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="Messages (Today)" value={metrics.messagesToday.toLocaleString()} subtitle="user messages" />
        <KPICard label="Token Usage (Today)" value={formatTokens(metrics.tokenUsageToday)} subtitle="input + output" />
        <KPICard label="Cost Estimate (MTD)" value={`$${metrics.costEstimateMTD.toLocaleString()}`} subtitle="this month" />
        <KPICard label="Error Rate" value={`${metrics.errorRate}%`} subtitle="today" />
      </div>

      <div className={styles.chartRow}>
        <Chart
          title="Average Response Latency"
          subtitle="Last 7 days (ms)"
          type="line"
          data={latencyChart}
          dataKeys={[{ key: 'avgLatency', name: 'Avg Latency (ms)', color: '#4f46e5' }]}
        />
      </div>

      {/* Model Usage Breakdown */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Model Usage (This Month)</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Requests</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelUsage.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>No data yet</td></tr>
                ) : modelUsage.map((m) => (
                  <tr key={m.model}>
                    <td><code>{m.model}</code></td>
                    <td>{m.count.toLocaleString()}</td>
                    <td>{formatTokens(m.totalTokens)}</td>
                    <td>${m.totalCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Recent Errors</h3>
        <DataTable columns={errorColumns} data={errors.errors as ErrorRow[]} />
      </div>

      {/* Flagged Conversations */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Flagged Conversations</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Conversation</th>
                  <th>Context</th>
                  <th>Messages</th>
                  <th>Last Activity</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {flagged.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>No flagged conversations</td></tr>
                ) : flagged.map((f) => (
                  <tr key={f.id}>
                    <td>{f.title || f.id.slice(0, 8)}</td>
                    <td><StatusBadge label={f.context} variant="default" /></td>
                    <td>{f.message_count}</td>
                    <td>{new Date(f.last_message_at).toLocaleString()}</td>
                    <td>{f.user_id.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
