import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

const featureFlags = [
  { key: 'ai_coach_v2', name: 'AI Coach V2', enabled: true, rollout: 100, description: 'New coach conversation engine' },
  { key: 'photo_meal_logging', name: 'Photo Meal Logging', enabled: true, rollout: 50, description: 'Camera-based meal logging' },
  { key: 'workout_ai_generation', name: 'AI Workout Generation', enabled: true, rollout: 75, description: 'AI-generated workout programs' },
  { key: 'social_features', name: 'Social Features', enabled: false, rollout: 0, description: 'Friend lists and sharing' },
  { key: 'advanced_analytics', name: 'Advanced Analytics', enabled: true, rollout: 25, description: 'Detailed progress analytics' },
  { key: 'supplement_tracking', name: 'Supplement Tracking', enabled: true, rollout: 100, description: 'Track daily supplements' },
];

const pricingConfig = [
  {
    tier: 'Free',
    monthly: '$0',
    annual: '$0',
    trial: '—',
    features: ['Basic workout logging', '3 meals/day', '5 AI messages/day'],
  },
  {
    tier: 'Workout Coach',
    monthly: '$14.99',
    annual: '$119.99',
    trial: '7 days',
    features: ['Unlimited workouts', 'AI workout programs', '30 AI messages/day'],
  },
  {
    tier: 'Nutrition Coach',
    monthly: '$14.99',
    annual: '$119.99',
    trial: '7 days',
    features: ['Unlimited meal logging', 'Photo recognition', '30 AI messages/day'],
  },
  {
    tier: 'Full Health Coach',
    monthly: '$29.99',
    annual: '$239.99',
    trial: '7 days',
    features: ['Everything included', 'Priority AI', 'Unlimited AI messages'],
  },
];

export default function ConfigPage() {
  return (
    <div>
      <PageHeader
        title="Config"
        description="Feature flags and pricing configuration (read-only)"
      />

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Feature Flags</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Rollout %</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {featureFlags.map((flag) => (
                  <tr key={flag.key}>
                    <td style={{ fontWeight: 500 }}>{flag.name}</td>
                    <td><code className={styles.code}>{flag.key}</code></td>
                    <td>
                      <StatusBadge
                        label={flag.enabled ? 'Enabled' : 'Disabled'}
                        variant={flag.enabled ? 'success' : 'default'}
                      />
                    </td>
                    <td>{flag.rollout}%</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{flag.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Pricing Configuration</h3>
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Monthly</th>
                  <th>Annual</th>
                  <th>Trial</th>
                  <th>Features</th>
                </tr>
              </thead>
              <tbody>
                {pricingConfig.map((plan) => (
                  <tr key={plan.tier}>
                    <td style={{ fontWeight: 500 }}>{plan.tier}</td>
                    <td>{plan.monthly}</td>
                    <td>{plan.annual}</td>
                    <td>{plan.trial}</td>
                    <td>
                      <ul className={styles.featureList}>
                        {plan.features.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </td>
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
