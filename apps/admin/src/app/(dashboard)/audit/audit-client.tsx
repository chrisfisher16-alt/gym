'use client';

import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterChips } from '@/components/FilterChips';
import { ExportButton } from '@/components/ExportButton';
import { Pagination } from '@/components/Pagination';
import { downloadExport } from '@/lib/export';
import type { AuditLogEntry } from '@/lib/queries/audit';
import styles from './page.module.css';

const ACTION_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Config Changes', value: 'config.update' },
  { label: 'Data Export', value: 'data.export' },
  { label: 'Support Notes', value: 'support.note_added' },
  { label: 'Auth', value: 'auth.login' },
];

const actionVariant = (action: string) => {
  if (action.startsWith('config')) return 'warning' as const;
  if (action.startsWith('data')) return 'info' as const;
  if (action.startsWith('support')) return 'primary' as const;
  if (action.startsWith('auth')) return 'success' as const;
  return 'default' as const;
};

type AuditRow = AuditLogEntry & { [key: string]: unknown };

const columns: Column<AuditRow>[] = [
  {
    key: 'created_at',
    header: 'Timestamp',
    sortable: true,
    render: (row) => <span>{new Date(row.created_at).toLocaleString()}</span>,
  },
  { key: 'admin_email', header: 'Admin' },
  {
    key: 'action',
    header: 'Action',
    render: (row) => <StatusBadge label={row.action} variant={actionVariant(row.action)} />,
  },
  { key: 'resource_type', header: 'Resource Type' },
  { key: 'resource_id', header: 'Resource ID' },
];

interface AuditClientProps {
  logs: AuditLogEntry[];
  total: number;
  currentPage: number;
  currentAction: string;
}

export function AuditClient({ logs, total, currentPage, currentAction }: AuditClientProps) {
  const router = useRouter();

  const handleFilter = (action: string) => {
    const params = new URLSearchParams();
    if (action !== 'all') params.set('action', action);
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <div className={styles.filterRow}>
        <FilterChips options={ACTION_FILTERS} selected={currentAction} onChange={handleFilter} />
        <ExportButton onClick={() => downloadExport('audit')} />
      </div>
      <DataTable columns={columns} data={logs as AuditRow[]} />
      <Pagination total={total} pageSize={20} currentPage={currentPage} />
    </>
  );
}
