'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterChips } from '@/components/FilterChips';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { ExportButton } from '@/components/ExportButton';
import { downloadExport } from '@/lib/export';
import type { FeedbackRow } from '@/lib/queries/feedback';
import styles from './page.module.css';

// ── Filter options ──────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Bug', value: 'bug' },
  { label: 'Feature Request', value: 'feature_request' },
  { label: 'AI Accuracy', value: 'ai_accuracy' },
  { label: 'General', value: 'general' },
];

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
  { label: 'Wont Fix', value: 'wont_fix' },
];

const PRIORITY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const categoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    bug: 'Bug',
    feature_request: 'Feature',
    ai_accuracy: 'AI Issue',
    general: 'General',
  };
  return map[cat] ?? cat;
};

const categoryVariant = (cat: string) => {
  const map: Record<string, 'danger' | 'primary' | 'warning' | 'info'> = {
    bug: 'danger',
    feature_request: 'primary',
    ai_accuracy: 'warning',
    general: 'info',
  };
  return map[cat] ?? ('default' as const);
};

const statusVariant = (status: string) => {
  const map: Record<string, 'warning' | 'info' | 'success' | 'default' | 'danger'> = {
    new: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'default',
    wont_fix: 'danger',
  };
  return map[status] ?? ('default' as const);
};

const priorityVariant = (priority: string | null) => {
  if (!priority) return 'default' as const;
  const map: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'default',
  };
  return map[priority] ?? ('default' as const);
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ── Table columns ───────────────────────────────────────────────────────

type FeedbackTableRow = FeedbackRow & { [key: string]: unknown };

const columns: Column<FeedbackTableRow>[] = [
  {
    key: 'created_at',
    header: 'When',
    sortable: true,
    render: (row) => (
      <span title={new Date(row.created_at).toLocaleString()}>
        {timeAgo(row.created_at)}
      </span>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (row) => (
      <StatusBadge label={categoryLabel(row.category)} variant={categoryVariant(row.category)} />
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <StatusBadge label={row.status.replace('_', ' ')} variant={statusVariant(row.status)} />
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    render: (row) =>
      row.priority ? (
        <StatusBadge label={row.priority} variant={priorityVariant(row.priority)} />
      ) : (
        <span className={styles.muted}>--</span>
      ),
  },
  {
    key: 'description',
    header: 'Description',
    render: (row) => (
      <span className={styles.descriptionCell} title={row.description}>
        {row.description.length > 80
          ? row.description.slice(0, 80) + '...'
          : row.description}
      </span>
    ),
  },
  {
    key: 'screen_context',
    header: 'Context',
    render: (row) => (
      <span className={styles.muted}>
        {row.screen_context ? row.screen_context.slice(0, 40) : '--'}
      </span>
    ),
  },
  {
    key: 'app_version',
    header: 'Version',
    render: (row) => <span className={styles.muted}>{row.app_version ?? '--'}</span>,
  },
];

// ── Detail Panel ────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
  onUpdateStatus,
}: {
  item: FeedbackRow;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string, notes?: string, priority?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(item.admin_notes ?? '');
  const [status, setStatus] = useState(item.status);
  const [priority, setPriority] = useState(item.priority ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateStatus(item.id, status, notes, priority || undefined);
    setSaving(false);
  };

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <h3 className={styles.detailTitle}>Feedback Detail</h3>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Close">
          x
        </button>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailMeta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Category</span>
            <StatusBadge label={categoryLabel(item.category)} variant={categoryVariant(item.category)} />
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Submitted</span>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>User</span>
            <span className={styles.muted}>{item.user_id.slice(0, 8)}...</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>App Version</span>
            <span>{item.app_version ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Device</span>
            <span>{item.device_info ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>OS</span>
            <span>{item.os_name ?? '--'} {item.os_version ?? ''}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Theme</span>
            <span>{item.theme ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Network</span>
            <span>{item.network_status ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Account Age</span>
            <span>{item.account_age_days != null ? `${item.account_age_days}d` : '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Workouts</span>
            <span>{item.workout_count ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Tier</span>
            <span>{item.subscription_tier ?? '--'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Context</span>
            <span>{item.screen_context ?? '--'}</span>
          </div>
        </div>

        <div className={styles.detailDescription}>
          <span className={styles.metaLabel}>Description</span>
          <p>{item.description}</p>
        </div>

        {item.screenshot_url && (
          <div className={styles.screenshotSection}>
            <span className={styles.metaLabel}>Screenshot</span>
            <div className={styles.screenshotPreview}>
              <span className={styles.muted}>{item.screenshot_url}</span>
            </div>
          </div>
        )}

        <div className={styles.adminSection}>
          <h4>Admin Actions</h4>

          <div className={styles.adminField}>
            <label htmlFor="detail-status">Status</label>
            <select
              id="detail-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={styles.select}
            >
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="wont_fix">Won&apos;t Fix</option>
            </select>
          </div>

          <div className={styles.adminField}>
            <label htmlFor="detail-priority">Priority</label>
            <select
              id="detail-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={styles.select}
            >
              <option value="">Unset</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className={styles.adminField}>
            <label htmlFor="detail-notes">Admin Notes</label>
            <textarea
              id="detail-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={styles.textarea}
              rows={3}
              placeholder="Internal notes about this feedback..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Component ───────────────────────────────────────────────

interface FeedbackClientProps {
  items: FeedbackRow[];
  total: number;
  currentPage: number;
  currentCategory: string;
  currentStatus: string;
  currentPriority: string;
  currentSearch: string;
}

export function FeedbackClient({
  items,
  total,
  currentPage,
  currentCategory,
  currentStatus,
  currentPriority,
  currentSearch,
}: FeedbackClientProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<FeedbackRow | null>(null);
  const [searchValue, setSearchValue] = useState(currentSearch);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = {
        category: currentCategory,
        status: currentStatus,
        priority: currentPriority,
        search: currentSearch,
        ...overrides,
      };
      for (const [key, value] of Object.entries(merged)) {
        if (value && value !== 'all' && value !== '') {
          params.set(key, value);
        }
      }
      return `?${params.toString()}`;
    },
    [currentCategory, currentStatus, currentPriority, currentSearch],
  );

  const handleUpdateStatus = async (
    id: string,
    status: string,
    notes?: string,
    priority?: string,
  ) => {
    try {
      const res = await fetch('/api/feedback/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, admin_notes: notes, priority }),
      });
      if (res.ok) {
        router.refresh();
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Failed to update feedback:', err);
    }
  };

  return (
    <div className={styles.clientWrapper}>
      <div className={styles.filtersSection}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Category</span>
          <FilterChips
            options={CATEGORY_FILTERS}
            selected={currentCategory}
            onChange={(val) => router.push(buildUrl({ category: val, page: '' }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status</span>
          <FilterChips
            options={STATUS_FILTERS}
            selected={currentStatus}
            onChange={(val) => router.push(buildUrl({ status: val, page: '' }))}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Priority</span>
          <FilterChips
            options={PRIORITY_FILTERS}
            selected={currentPriority}
            onChange={(val) => router.push(buildUrl({ priority: val, page: '' }))}
          />
        </div>
        <div className={styles.filterActions}>
          <SearchInput
            placeholder="Search feedback..."
            value={searchValue}
            onChange={(val) => {
              setSearchValue(val);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                router.push(buildUrl({ search: val, page: '' }));
              }, 400);
            }}
          />
          <ExportButton onClick={() => downloadExport('feedback')} />
        </div>
      </div>

      <div className={styles.contentArea}>
        <div className={selectedItem ? styles.tableNarrow : styles.tableFull}>
          <DataTable
            columns={columns}
            data={items as FeedbackTableRow[]}
            onRowClick={(row) => setSelectedItem(row as FeedbackRow)}
            emptyMessage="No feedback found"
          />
          <Pagination total={total} pageSize={20} currentPage={currentPage} />
        </div>

        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </div>
    </div>
  );
}
