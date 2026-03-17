export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { getUserById, getUserWorkouts, getUserMeals, getUserCoachMessages, getSupportNotes } from '@/lib/queries/users';
import { SupportNotesSection } from './support-notes';
import styles from './page.module.css';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const [workouts, meals, messages, notes] = await Promise.all([
    getUserWorkouts(id, 10),
    getUserMeals(id, 10),
    getUserCoachMessages(id, 10),
    getSupportNotes(id),
  ]);

  const tierLabel = user.tier?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Free';

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
              {(user.display_name || user.email).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className={styles.profileName}>{user.display_name || 'No name'}</h2>
              <p className={styles.profileEmail}>{user.email}</p>
              <p className={styles.profileMeta}>Joined {new Date(user.signed_up_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="card card-body">
          <h3 className={styles.sectionTitle}>Subscription</h3>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Tier</span>
              <StatusBadge label={tierLabel} variant="primary" />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Trial</span>
              <StatusBadge label={user.is_trial ? 'Yes' : 'No'} variant={user.is_trial ? 'warning' : 'default'} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Product Mode</span>
              <span>{user.product_mode.replace(/_/g, ' ')}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Onboarding</span>
              <StatusBadge label={user.onboarding_completed ? 'Complete' : 'Pending'} variant={user.onboarding_completed ? 'success' : 'warning'} />
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className="card card-body">
          <h3 className={styles.sectionTitle}>Goals</h3>
          <div className={styles.infoList}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Active Goals</span>
              <span>{user.active_goals}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className={styles.statsGrid}>
        <KPICard label="Workouts" value={user.total_workouts} subtitle="total completed" />
        <KPICard label="Meals Logged" value={user.total_meals_logged} subtitle="total logged" />
        <KPICard label="Coach Messages" value={user.total_ai_messages} subtitle="total sent" />
        <KPICard label="Active Goals" value={user.active_goals} subtitle="in progress" />
      </div>

      {/* Recent Workouts */}
      <div className={`card ${styles.activityCard}`}>
        <h3 className={styles.sectionTitle}>Recent Workouts</h3>
        <div className={styles.timeline}>
          {workouts.length === 0 && <p className={styles.placeholder}>No workouts logged yet.</p>}
          {workouts.map((w) => (
            <div key={w.id} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineContent}>
                <span className={styles.timelineDesc}>
                  {w.name || 'Workout'} {w.completed_at ? '✓' : '(in progress)'}
                  {w.duration_seconds ? ` — ${Math.round(w.duration_seconds / 60)}min` : ''}
                </span>
                <span className={styles.timelineTime}>{new Date(w.started_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Meals */}
      <div className={`card ${styles.activityCard}`}>
        <h3 className={styles.sectionTitle}>Recent Meals</h3>
        <div className={styles.timeline}>
          {meals.length === 0 && <p className={styles.placeholder}>No meals logged yet.</p>}
          {meals.map((m) => (
            <div key={m.id} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineContent}>
                <span className={styles.timelineDesc}>
                  {m.name || m.meal_type} ({m.source})
                </span>
                <span className={styles.timelineTime}>{new Date(m.logged_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Coach Messages */}
      <div className={`card ${styles.activityCard}`}>
        <h3 className={styles.sectionTitle}>Recent Coach Messages</h3>
        <div className={styles.timeline}>
          {messages.length === 0 && <p className={styles.placeholder}>No coach messages yet.</p>}
          {messages.map((msg) => (
            <div key={msg.id} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div className={styles.timelineContent}>
                <span className={styles.timelineDesc}>
                  [{msg.role}] {msg.content?.slice(0, 100)}{(msg.content?.length ?? 0) > 100 ? '...' : ''}
                </span>
                <span className={styles.timelineTime}>{new Date(msg.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support Notes */}
      <SupportNotesSection userId={id} initialNotes={notes} />
    </div>
  );
}
