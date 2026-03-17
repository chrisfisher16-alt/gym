'use client';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

const signupsData = [
  { name: 'Mon', signups: 32 },
  { name: 'Tue', signups: 45 },
  { name: 'Wed', signups: 38 },
  { name: 'Thu', signups: 52 },
  { name: 'Fri', signups: 48 },
  { name: 'Sat', signups: 61 },
  { name: 'Sun', signups: 55 },
];

const activeUsersData = [
  { name: 'W1', dau: 1200, wau: 4500, mau: 12000 },
  { name: 'W2', dau: 1350, wau: 4800, mau: 12500 },
  { name: 'W3', dau: 1280, wau: 4600, mau: 12800 },
  { name: 'W4', dau: 1420, wau: 5100, mau: 13200 },
];

const revenueData = [
  { name: 'Jan', revenue: 28000 },
  { name: 'Feb', revenue: 31000 },
  { name: 'Mar', revenue: 34500 },
  { name: 'Apr', revenue: 36000 },
  { name: 'May', revenue: 38200 },
  { name: 'Jun', revenue: 42000 },
];

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform health at a glance"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="New Users (This Week)" value="331" trend={{ value: 12, direction: 'up' }} subtitle="vs last week" />
        <KPICard label="Active Users (DAU)" value="1,420" trend={{ value: 8, direction: 'up' }} subtitle="vs last week" />
        <KPICard label="Active Users (WAU)" value="5,100" trend={{ value: 5, direction: 'up' }} />
        <KPICard label="Active Users (MAU)" value="13,200" trend={{ value: 3, direction: 'up' }} />
        <KPICard label="Paid Conversion Rate" value="6.8%" trend={{ value: 0.4, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="MRR" value="$42,000" trend={{ value: 10, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="Churn Rate" value="3.2%" trend={{ value: 0.5, direction: 'down' }} subtitle="improved" />
        <KPICard label="Workouts Completed" value="8,340" trend={{ value: 15, direction: 'up' }} subtitle="this week" />
        <KPICard label="Meals Logged" value="24,120" trend={{ value: 7, direction: 'up' }} subtitle="this week" />
        <KPICard label="Coach Sessions" value="3,890" trend={{ value: 22, direction: 'up' }} subtitle="this week" />
        <KPICard label="AI Cost Estimate" value="$2,140" trend={{ value: 18, direction: 'up' }} subtitle="this month" />
      </div>

      <div className={styles.chartsGrid}>
        <Chart
          title="Signups Over Time"
          subtitle="Last 7 days"
          type="line"
          data={signupsData}
          dataKeys={[{ key: 'signups', name: 'Signups', color: '#4f46e5' }]}
        />
        <Chart
          title="Active Users Over Time"
          subtitle="Weekly trend"
          type="line"
          data={activeUsersData}
          dataKeys={[
            { key: 'dau', name: 'DAU', color: '#4f46e5' },
            { key: 'wau', name: 'WAU', color: '#059669' },
          ]}
        />
        <Chart
          title="Revenue Over Time"
          subtitle="Monthly"
          type="bar"
          data={revenueData}
          dataKeys={[{ key: 'revenue', name: 'Revenue ($)', color: '#4f46e5' }]}
        />
      </div>
    </div>
  );
}
