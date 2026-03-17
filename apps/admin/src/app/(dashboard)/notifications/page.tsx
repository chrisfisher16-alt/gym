'use client';

import { KPICard } from '@/components/KPICard';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

const reminderTypes = [
  { type: 'Workout Reminder', sent: 4200, opened: 2100, rate: '50%' },
  { type: 'Meal Logging Reminder', sent: 3800, opened: 1520, rate: '40%' },
  { type: 'Supplement Reminder', sent: 1200, opened: 720, rate: '60%' },
  { type: 'Coach Tips', sent: 2600, opened: 1820, rate: '70%' },
  { type: 'Progress Update', sent: 1800, opened: 1260, rate: '70%' },
  { type: 'Streak Alert', sent: 900, opened: 630, rate: '70%' },
];

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Push notification analytics and scheduling"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="Opt-in Rate" value="67%" trend={{ value: 2, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="Reminders Scheduled" value="14,500" subtitle="this week" />
        <KPICard label="Overall Open Rate" value="54%" trend={{ value: 3, direction: 'up' }} subtitle="vs last month" />
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
                {reminderTypes.map((row) => (
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
