'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import type { FeatureFlag, PricingConfig } from '@/lib/queries/config';
import styles from './page.module.css';

interface Props {
  flags: FeatureFlag[];
  pricing: PricingConfig[];
}

export function ConfigClient({ flags, pricing }: Props) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (flagId: string, currentEnabled: boolean) => {
    if (!confirm(`Are you sure you want to ${currentEnabled ? 'disable' : 'enable'} this feature flag?`)) {
      return;
    }

    setToggling(flagId);
    try {
      const res = await fetch('/api/config/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, is_enabled: !currentEnabled }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setToggling(null);
    }
  };

  return (
    <>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id}>
                    <td style={{ fontWeight: 500 }}>
                      {flag.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td><code className={styles.code}>{flag.key}</code></td>
                    <td>
                      <StatusBadge
                        label={flag.is_enabled ? 'Enabled' : 'Disabled'}
                        variant={flag.is_enabled ? 'success' : 'default'}
                      />
                    </td>
                    <td>{flag.rollout_percentage}%</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{flag.description}</td>
                    <td>
                      <button
                        onClick={() => handleToggle(flag.id, flag.is_enabled)}
                        disabled={toggling === flag.id}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-bg-card)',
                          cursor: toggling === flag.id ? 'wait' : 'pointer',
                        }}
                      >
                        {toggling === flag.id ? '...' : flag.is_enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
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
                  <th>Active</th>
                  <th>Features</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((plan) => (
                  <tr key={plan.id}>
                    <td style={{ fontWeight: 500 }}>{plan.display_name}</td>
                    <td>{plan.price_monthly_usd ? `$${plan.price_monthly_usd}` : '—'}</td>
                    <td>{plan.price_yearly_usd ? `$${plan.price_yearly_usd}` : '—'}</td>
                    <td>
                      <StatusBadge
                        label={plan.is_active ? 'Active' : 'Inactive'}
                        variant={plan.is_active ? 'success' : 'default'}
                      />
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                      {plan.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
