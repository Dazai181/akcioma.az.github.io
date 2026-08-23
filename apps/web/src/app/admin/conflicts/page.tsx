'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Status = 'UNRESOLVED' | 'KEPT_EXISTING' | 'KEPT_INCOMING' | 'MERGED';

interface ConflictRow {
  id: string;
  status: Status;
  matchedBy: string;
  productId: string | null;
  incomingData: { name?: string; rowNumber?: number };
  existingData: any;
  createdAt: string;
  job: { source: 'ERP_API' | 'EXCEL_UPLOAD'; fileName: string | null; startedAt: string };
}

const STATUSES: Status[] = ['UNRESOLVED', 'KEPT_EXISTING', 'KEPT_INCOMING', 'MERGED'];

export default function ConflictsList() {
  const [status, setStatus] = useState<Status>('UNRESOLVED');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'conflicts', status],
    queryFn: async () => {
      const { data } = await api.get<ConflictRow[]>('/admin/conflicts', {
        params: { status },
      });
      return data;
    },
    refetchInterval: 4000,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded border ${
              status === s ? 'border-accent text-accent font-semibold' : ''
            }`}
            style={{ borderColor: status === s ? 'var(--aksioma-accent)' : 'var(--aksioma-border)' }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--aksioma-border)' }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
            <tr>
              <th className="text-left p-2">Zaman</th>
              <th className="text-left p-2">Kaynak</th>
              <th className="text-left p-2">Eşleşme</th>
              <th className="text-left p-2">Gelen Ürün</th>
              <th className="text-left p-2">Durum</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-4 text-center">Yükleniyor…</td>
              </tr>
            )}
            {data?.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                <td className="p-2 whitespace-nowrap">{new Date(c.createdAt).toLocaleString('tr-TR')}</td>
                <td className="p-2">{c.job.source === 'EXCEL_UPLOAD' ? c.job.fileName ?? 'Excel' : 'ERP'}</td>
                <td className="p-2"><code className="text-xs">{c.matchedBy}</code></td>
                <td className="p-2 truncate max-w-[260px]">
                  {c.incomingData?.name ?? '—'}
                  {c.incomingData?.rowNumber && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                      satır {c.incomingData.rowNumber}
                    </span>
                  )}
                </td>
                <td className="p-2"><code className="text-xs">{c.status}</code></td>
                <td className="p-2 text-right">
                  <Link href={`/admin/conflicts/${c.id}`} className="text-accent underline text-xs">
                    {c.status === 'UNRESOLVED' ? 'Çöz →' : 'Görüntüle →'}
                  </Link>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Bu durumda çakışma yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
