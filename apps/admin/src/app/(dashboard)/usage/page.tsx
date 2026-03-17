'use client';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

const workoutData = [
  { name: 'Mon', completed: 1200 },
  { name: 'Tue', completed: 1450 },
  { name: 'Wed', completed: 1380 },
  { name: 'Thu', completed: 1520 },
  { name: 'Fri', completed: 1100 },
  { name: 'Sat', completed: 890 },
  { name: 'Sun', completed: 800 },
];

const mealData = [
  { name: 'Mon', logged: 3400 },
  { name: 'Tue', logged: 3600 },
  { name: 'Wed', logged: 3500 },
  { name: 'Thu', logged: 3700 },
  { name: 'Fri', logged: 3300 },
  { name: 'Sat', logged: 2800 },
  { name: 'Sun', logged: 2820 },
];

const cohortData = [
  { week: 'W1', w0: '100%', w1: '72%', w2: '58%', w3: '51%', w4: '45%' },
  { week: 'W2', w0: '100%', w1: '68%', w2: '55%', w3: '48%', w4: '—' },
  { week: 'W3', w0: '100%', w1: '71%', w2: '57%', w3: '—', w4: '—' },
  { week: 'W4', w0: '100%', w1: '74%', w2: '—', w3: '—', w4: '—' },
];

const funnelData = [
  { step: 'App Opened', count: 10000, pct: '100%' },
  { step: 'Onboarding Started', count: 8200, pct: '82%' },
  { step: 'Goals Set', count: 6800, pct: '68%' },
  { step: 'First Workout Logged', count: 4200, pct: '42%' },
  { step: 'First Meal Logged', count: 3800, pct: '38%' },
  { step: 'First Week Completed', count: 2900, pct: '29%' },
];

export default function UsagePage() {
  return (
    <div>
      <PageHeader
        title="Usage"
        description="User engagement and retention metrics"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="DAU" value="1,420" trend={{ value: 8, direction: 'up' }} subtitle="vs last week" />
        <KPICard label="WAU" value="5,100" trend={{ value: 5, direction: 'up' }} subtitle="vs last week" />
        <KPICard label="MAU" value="13,200" trend={{ value: 3, direction: 'up' }} subtitle="vs last month" />
        <KPICard label="DAU/MAU Ratio" value="10.8%" subtitle="stickiness" />
      </div>

      <div className={styles.chartsGrid}>
        <Chart
          title="Workout Completions"
          subtitle="Last 7 days"
          type="bar"
          data={workoutData}
          dataKeys={[{ key: 'completed', name: 'Workouts', color: '#4f46e5' }]}
        />
        <Chart
          title="Meal Logging"
          subtitle="Last 7 days"
          type="bar"
          data={mealData}
          dataKeys={[{ key: 'logged', name: 'Meals Logged', color: '#059669' }]}
        />
      </div>

      {/* Retention Cohort Table */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Retention Cohorts (Weekly)</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Week 0</th>
                  <th>Week 1</th>
                  <th>Week 2</th>
                  <th>Week 3</th>
                  <th>Week 4</th>
                </tr>
              </thead>
              <tbody>
                {cohortData.map((row) => (
                  <tr key={row.week}>
                    <td>{row.week}</td>
                    <td>{row.w0}</td>
                    <td>{row.w1}</td>
                    <td>{row.w2}</td>
                    <td>{row.w3}</td>
                    <td>{row.w4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Onboarding Funnel */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Onboarding Funnel</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Users</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {funnelData.map((row) => (
                  <tr key={row.step}>
                    <td>{row.step}</td>
                    <td>{row.count.toLocaleString()}</td>
                    <td>{row.pct}</td>
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
