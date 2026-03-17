export const dynamic = 'force-dynamic';

import { KPICard } from '@/components/KPICard';
import { PageHeader } from '@/components/PageHeader';
import { getNotificationMetrics, getReminderPerformance } from '@/lib/queries/notifications';
import styles from './page.module.css';

export default async function NotificationsPage() {
  const [metrics, reminders] = await Promise.all([
    getNotificationMetrics(),
    getReminderPerformance(),
  ]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Push notification analytics and scheduling"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="Opt-in Rate" value={`${metrics.optInRate}%`} subtitle="with push token" />
        <KPICard label="Scheduled" value={metrics.scheduledCount.toLocaleString()} subtitle="pending delivery" />
        <KPICard label="Overall Open Rate" value={`${metrics.overallOpenRate}%`} subtitle="last 7 days" />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Reminder Type Performance</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reminder Type</th>
                  <th>Sent (This Week)</th>
                  <th>Opened</th>
                  <th>Open Rate</th>
                </tr>
              </thead>
              <tbody>
                {reminders.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>No notification data yet</td></tr>
                ) : reminders.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td>{row.sent.toLocaleString()}</td>
                    <td>{row.opened.toLocaleString()}</td>
                    <td>{row.rate}</td>
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
