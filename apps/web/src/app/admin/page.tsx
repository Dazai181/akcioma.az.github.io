'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SyncJob {
  id: string;
  source: 'ERP_API' | 'EXCEL_UPLOAD';
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalRows: number;
  successRows: number;
  failedRows: number;
  fileName: string | null;
  _count: { conflicts: number };
}

interface Conflict { id: string; status: string }

export default function AdminDashboard() {
  const jobs = useQuery({
    queryKey: ['admin', 'sync', 'jobs'],
    queryFn: async () => {
      const { data } = await api.get<SyncJob[]>('/admin/sync/jobs');
      return data;
    },
  });

  const conflicts = useQuery({
    queryKey: ['admin', 'conflicts', 'UNRESOLVED'],
    queryFn: async () => {
      const { data } = await api.get<Conflict[]>('/admin/conflicts', {
        params: { status: 'UNRESOLVED' },
      });
      return data;
    },
  });

  const lastJob = jobs.data?.[0];
  const unresolved = conflicts.data?.length ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Çözülmemiş çakışma" value={unresolved} link={{ href: '/admin/conflicts', label: 'İncele →' }} highlight={unresolved > 0} />
      <Card
        title="Son senkron"
        value={lastJob ? `${lastJob.successRows}/${lastJob.totalRows}` : '—'}
        subtitle={lastJob?.fileName ?? lastJob?.source ?? 'Henüz yok'}
        link={{ href: '/admin/sync', label: 'Geçmiş →' }}
      />
      <Card title="Toplam senkron işi" value={jobs.data?.length ?? 0} link={{ href: '/admin/sync', label: 'Aç →' }} />
    </div>
  );
}

function Card({
  title,
  value,
  subtitle,
  link,
  highlight,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  link?: { href: string; label: string };
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: highlight ? 'var(--aksioma-accent)' : 'var(--aksioma-border)',
        background: 'var(--aksioma-card)',
      }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--aksioma-muted)' }}>
        {title}
      </div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? 'text-accent' : ''}`}>{value}</div>
      {subtitle && <div className="text-xs mt-1" style={{ color: 'var(--aksioma-muted)' }}>{subtitle}</div>}
      {link && (
        <Link href={link.href} className="text-xs mt-2 inline-block underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}
