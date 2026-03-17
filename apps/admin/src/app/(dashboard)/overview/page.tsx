export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { PageHeader } from '@/components/PageHeader';
import { getOverviewKPIs, getSignupTrend, getActiveUsersTrend, getRevenueTrend } from '@/lib/queries/overview';
import styles from './page.module.css';

export default async function OverviewPage() {
  const [kpis, signups, activeUsers, revenue] = await Promise.all([
    getOverviewKPIs(),
    getSignupTrend(30),
    getActiveUsersTrend(30),
    getRevenueTrend(30),
  ]);

  const signupsChart = signups.map((s) => ({ name: s.name, signups: s.value }));
  const activeChart = activeUsers.map((a) => ({
    name: a.name,
    workout: a.workoutUsers,
    nutrition: a.nutritionUsers,
  }));
  const revenueChart = revenue.map((r) => ({ name: r.name, revenue: r.value }));

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform health at a glance"
      />

      <Suspense fallback={<div>Loading KPIs...</div>}>
        <div className={styles.kpiGrid}>
          <KPICard label="New Users (7d)" value={kpis.newUsers7d.toLocaleString()} subtitle="last 7 days" />
          <KPICard label="New Users (30d)" value={kpis.newUsers30d.toLocaleString()} subtitle="last 30 days" />
          <KPICard label="DAU" value={kpis.dau.toLocaleString()} subtitle="today" />
          <KPICard label="WAU" value={kpis.wau.toLocaleString()} subtitle="last 7 days" />
          <KPICard label="MAU" value={kpis.mau.toLocaleString()} subtitle="last 30 days" />
          <KPICard label="Paid Conversion" value={`${kpis.paidConversionRate}%`} subtitle="of total users" />
          <KPICard label="MRR" value={`$${kpis.mrr.toLocaleString()}`} subtitle="monthly recurring" />
          <KPICard label="Churn Rate" value={`${kpis.churnRate}%`} subtitle="this month" />
          <KPICard label="Workouts (7d)" value={kpis.workoutsCompleted7d.toLocaleString()} subtitle="completed" />
          <KPICard label="Meals (7d)" value={kpis.mealsLogged7d.toLocaleString()} subtitle="logged" />
          <KPICard label="Coach Sessions (7d)" value={kpis.coachSessions7d.toLocaleString()} subtitle="conversations" />
          <KPICard label="AI Cost (30d)" value={`$${kpis.aiCostEstimate30d.toLocaleString()}`} subtitle="estimated" />
        </div>
      </Suspense>

      <div className={styles.chartsGrid}>
        <Chart
          title="Signups"
          subtitle="Last 30 days"
          type="line"
          data={signupsChart}
          dataKeys={[{ key: 'signups', name: 'Signups', color: '#4f46e5' }]}
        />
        <Chart
          title="Active Users"
          subtitle="Last 30 days"
          type="line"
          data={activeChart}
          dataKeys={[
            { key: 'workout', name: 'Workout Users', color: '#4f46e5' },
            { key: 'nutrition', name: 'Nutrition Users', color: '#059669' },
          ]}
        />
        <Chart
          title="Revenue"
          subtitle="Daily (last 30 days)"
          type="bar"
          data={revenueChart}
          dataKeys={[{ key: 'revenue', name: 'Revenue ($)', color: '#4f46e5' }]}
        />
      </div>
    </div>
  );
}
