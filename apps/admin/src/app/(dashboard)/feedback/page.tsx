export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { getFeedbackKPIs, getFeedbackList } from '@/lib/queries/feedback';
import { FeedbackClient } from './feedback-client';
import styles from './page.module.css';

interface Props {
  searchParams: Promise<{
    page?: string;
    category?: string;
    status?: string;
    priority?: string;
    search?: string;
  }>;
}

export default async function FeedbackPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [kpis, feedbackData] = await Promise.all([
    getFeedbackKPIs(),
    getFeedbackList(page, 20, {
      category: params.category,
      status: params.status,
      priority: params.priority,
      search: params.search,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="User feedback and feature requests"
      />

      <div className={styles.kpiGrid}>
        <KPICard label="Total Feedback" value={kpis.totalFeedback} subtitle="all time" />
        <KPICard label="Open" value={kpis.openCount} subtitle="needs review" />
        <KPICard label="Today" value={kpis.todayCount} subtitle="submitted today" />
        <KPICard label="This Week" value={kpis.weekCount} subtitle="last 7 days" />
        <KPICard label="Bugs" value={kpis.bugCount} subtitle="bug reports" />
        <KPICard label="Feature Requests" value={kpis.featureRequestCount} subtitle="ideas" />
        <KPICard label="AI Issues" value={kpis.aiAccuracyCount} subtitle="accuracy reports" />
      </div>

      <FeedbackClient
        items={feedbackData.items}
        total={feedbackData.total}
        currentPage={page}
        currentCategory={params.category ?? 'all'}
        currentStatus={params.status ?? 'all'}
        currentPriority={params.priority ?? 'all'}
        currentSearch={params.search ?? ''}
      />
    </div>
  );
}
