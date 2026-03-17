export const dynamic = 'force-dynamic';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { PageHeader } from '@/components/PageHeader';
import { getRevenueMetrics, getSubscriptionEvents, getPlanMix } from '@/lib/queries/revenue';
import { RevenueClient } from './revenue-client';
import styles from './page.module.css';

interface Props {
  searchParams: Promise<{ page?: string; eventType?: string }>;
}

export default async function RevenuePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [metrics, events, planMix] = await Promise.all([
    getRevenueMetrics(),
    getSubscriptionEvents(page, 20, params.eventType),
    getPlanMix(),
  ]);

  const planMixChart = planMix.map((p) => ({
    name: p.plan_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: p.count,
  }));

  // Per-tier KPIs from the view plan_mix
  const tierKpis = metrics.planMix.map((p) => ({
    plan: p.plan_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    subscribers: p.subscribers,
  }));

  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Subscription revenue and plan analytics"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="MRR" value={`$${metrics.mrr.toLocaleString()}`} subtitle="monthly recurring" />
        <KPICard label="Active Subscriptions" value={metrics.totalActiveSubscribers.toLocaleString()} />
        <KPICard label="Churn Rate" value={`${metrics.churnRatePct}%`} subtitle="this month" />
        {tierKpis.map((t) => (
          <KPICard key={t.plan} label={t.plan} value={t.subscribers.toLocaleString()} subtitle="active subs" />
        ))}
      </div>

      <div className={styles.chartRow}>
        <Chart
          title="Plan Mix"
          subtitle="Users by tier"
          type="pie"
          data={planMixChart}
          dataKeys={[{ key: 'value' }]}
        />
      </div>

      <RevenueClient
        events={events.events}
        total={events.total}
        currentPage={page}
        currentEventType={params.eventType ?? 'all'}
      />
    </div>
  );
}
