'use client';

import { use } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import styles from './page.module.css';

const DEMO_USER = {
  id: 'u1',
  name: 'Sarah Chen',
  email: 'sarah@example.com',
  avatarUrl: null,
  joined: '2024-11-15',
  tier: 'full_health_coach' as const,
  productMode: 'Full Health Coach',
  subscriptionStatus: 'active' as const,
  platform: 'ios' as const,
  goals: {
    type: 'build_muscle' as const,
    targetWeight: '68 kg',
    activityLevel: 4,
    status: 'active' as const,
  },
  stats: {
    workouts: 48,
    meals: 156,
    coachMessages: 89,
    streakDays: 12,
  },
  recentActivity: [
    { type: 'workout', description: 'Completed Upper Body Push', time: '2 hours ago' },
    { type: 'meal', description: 'Logged lunch (540 cal)', time: '4 hours ago' },
    { type: 'coach', description: 'Asked about protein timing', time: '5 hours ago' },
    { type: 'workout', description: 'Completed Lower Body Pull', time: '1 day ago' },
    { type: 'meal', description: 'Logged dinner (680 cal)', time: '1 day ago' },
  ],
};

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div>
      <PageHeader
        title="User Detail"
        description={`User ID: ${id}`}
      />

      <div className={styles.grid}>
        {/* Profile Card */}
        <div className={`card ${styles.profileCard}`}>
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {DEMO_USER.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className={styles.profileName}>{DEMO_USER.name}</h2>
              <p className={styles.profileEmail}>{DEMO_USER.email}</p>
              <p className={styles.profileMeta}>Joined {DEMO_USER.joined}</p>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className={`card card-body`}>
          <h3 className={styles.sectionTitle}>Subscription</h3>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Tier</span>
              <StatusBadge label={DEMO_USER.productMode} variant="primary" />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <StatusBadge label={DEMO_USER.subscriptionStatus} variant="success" />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Platform</span>
              <span>{DEMO_USER.platform.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className={`card card-body`}>
          <h3 className={styles.sectionTitle}>Goals</h3>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Goal Type</span>
              <span>Build Muscle</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Target Weight</span>
              <span>{DEMO_USER.goals.targetWeight}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Activity Level</span>
              <span>{DEMO_USER.goals.activityLevel}/5</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <StatusBadge label={DEMO_USER.goals.status} variant="success" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className={styles.statsGrid}>
        <KPICard label="Workouts" value={DEMO_USER.stats.workouts} subtitle="total completed" />
        <KPICard label="Meals Logged" value={DEMO_USER.stats.meals} subtitle="total logged" />
        <KPICard label="Coach Messages" value={DEMO_USER.stats.coachMessages} subtitle="total sent" />
        <KPICard label="Current Streak" value={`${DEMO_USER.stats.streakDays} days`} subtitle="consecutive" />
      </div>

      {/* Recent Activity */}
      <div className={`card ${styles.activityCard}`}>
        <h3 className={styles.sectionTitle}>Recent Activity</h3>
        <div className={styles.timeline}>
          {DEMO_USER.recentActivity.map((activity, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineContent}>
                <span className={styles.timelineDesc}>{activity.description}</span>
                <span className={styles.timelineTime}>{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support Notes */}
      <div className={`card card-body ${styles.notesCard}`}>
        <h3 className={styles.sectionTitle}>Support Notes</h3>
        <p className={styles.placeholder}>No support notes yet. Notes will appear here when added by support staff.</p>
      </div>
    </div>
  );
}
