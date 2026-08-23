'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SyncJob {
  id: string;
  source: 'ERP_API' | 'EXCEL_UPLOAD';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName: string | null;
  totalRows: number;
  successRows: number;
  failedRows: number;
  startedAt: string;
  completedAt: string | null;
  errorLog: any;
  _count: { conflicts: number };
}

const COLUMNS_DOC = `Excel/CSV başlıkları (zorunlu olanlar *):
  • name *               ürün adı
  • category_slug *      kategori slug (örn: yazi-gerecleri)
  • stock_qty *          stok adedi (tam sayı)
  • standard_price *     standart fiyat
  • favorite_price       VIP fiyat (opsiyonel)
  • special_price        özel fiyat (opsiyonel)
  • sku                  ürün kodu
  • barcode              barkod
  • description          açıklama`;

export default function AdminSyncPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const jobs = useQuery({
    queryKey: ['admin', 'sync', 'jobs'],
    queryFn: async () => {
      const { data } = await api.get<SyncJob[]>('/admin/sync/jobs');
      return data;
    },
    refetchInterval: (q) => {
      const data = q.state.data as SyncJob[] | undefined;
      const inFlight = data?.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING');
      return inFlight ? 1500 : false;
    },
  });

  const onUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<SyncJob>('/admin/sync/excel/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg(`İş başlatıldı: ${data.id.slice(0, 8)}…`);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['admin', 'sync', 'jobs'] });
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  };

  const onErpTrigger = async () => {
    setMsg(null);
    try {
      const { data } = await api.post<SyncJob>('/admin/sync/erp/trigger');
      setMsg(`ERP iş başlatıldı: ${data.id.slice(0, 8)}…`);
      qc.invalidateQueries({ queryKey: ['admin', 'sync', 'jobs'] });
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'ERP tetiklemesi başarısız.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-bold mb-2">Excel/CSV Yükle</h2>
        <form onSubmit={onUpload} className="flex flex-col sm:flex-row gap-2 items-start">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="text-sm"
          />
          <button
            disabled={uploading}
            className="rounded bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? 'Yükleniyor…' : 'Yükle ve İşle'}
          </button>
        </form>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer" style={{ color: 'var(--aksioma-muted)' }}>
            Beklenen sütunlar
          </summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono">{COLUMNS_DOC}</pre>
        </details>
      </section>

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">ERP Senkronu</h2>
          <button
            onClick={onErpTrigger}
            className="rounded border px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--aksioma-border)' }}
          >
            ERP'den Çek
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
          ERP_BASE_URL ve ERP_API_KEY ortam değişkenleri yapılandırılmamışsa iş "FAILED" olarak işaretlenir.
        </p>
      </section>

      {msg && (
        <div
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
        >
          {msg}
        </div>
      )}

      <section>
        <h2 className="font-bold mb-2">İş Geçmişi</h2>
        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--aksioma-border)' }}>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
              <tr>
                <th className="text-left p-2">Zaman</th>
                <th className="text-left p-2">Kaynak</th>
                <th className="text-left p-2">Dosya</th>
                <th className="text-left p-2">Durum</th>
                <th className="text-right p-2">Toplam</th>
                <th className="text-right p-2">Başarılı</th>
                <th className="text-right p-2">Hata</th>
                <th className="text-right p-2">Çakışma</th>
              </tr>
            </thead>
            <tbody>
              {jobs.data?.map((j) => (
                <tr key={j.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                  <td className="p-2 whitespace-nowrap">{new Date(j.startedAt).toLocaleString('tr-TR')}</td>
                  <td className="p-2">{j.source === 'EXCEL_UPLOAD' ? 'Excel' : 'ERP'}</td>
                  <td className="p-2 truncate max-w-[200px]">{j.fileName ?? '—'}</td>
                  <td className="p-2">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="p-2 text-right">{j.totalRows}</td>
                  <td className="p-2 text-right text-green-600 dark:text-green-400">{j.successRows}</td>
                  <td className="p-2 text-right text-red-600 dark:text-red-400">{j.failedRows}</td>
                  <td className="p-2 text-right">
                    {j._count.conflicts > 0 ? (
                      <Link href="/admin/conflicts" className="text-accent underline">
                        {j._count.conflicts}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              ))}
              {jobs.data?.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                    Henüz senkron işi yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <span className={`text-xs font-semibold rounded px-2 py-0.5 ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}
