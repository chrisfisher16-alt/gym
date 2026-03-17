export const dynamic = 'force-dynamic';

import { KPICard } from '@/components/KPICard';
import { Chart } from '@/components/Chart';
import { PageHeader } from '@/components/PageHeader';
import {
  getDAU, getWAU, getMAU,
  getWorkoutMetrics, getMealMetrics,
  getRetentionCohort, getOnboardingFunnel,
} from '@/lib/queries/usage';
import styles from './page.module.css';

export default async function UsagePage() {
  const [dau, wau, mau, workouts, meals, cohort, funnel] = await Promise.all([
    getDAU(),
    getWAU(),
    getMAU(),
    getWorkoutMetrics(7),
    getMealMetrics(7),
    getRetentionCohort(4),
    getOnboardingFunnel(),
  ]);

  const dauMauRatio = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0';

  return (
    <div>
      <PageHeader
        title="Usage"
        description="User engagement and retention metrics"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="DAU" value={dau.toLocaleString()} subtitle="today" />
        <KPICard label="WAU" value={wau.toLocaleString()} subtitle="last 7 days" />
        <KPICard label="MAU" value={mau.toLocaleString()} subtitle="last 30 days" />
        <KPICard label="DAU/MAU Ratio" value={`${dauMauRatio}%`} subtitle="stickiness" />
      </div>

      <div className={styles.chartsGrid}>
        <Chart
          title="Workout Completions"
          subtitle="Last 7 days"
          type="bar"
          data={workouts.data}
          dataKeys={[{ key: 'completed', name: 'Workouts', color: '#4f46e5' }]}
        />
        <Chart
          title="Meal Logging"
          subtitle="Last 7 days"
          type="bar"
          data={meals.data}
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
                {cohort.map((row) => (
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
                {funnel.map((row) => (
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
