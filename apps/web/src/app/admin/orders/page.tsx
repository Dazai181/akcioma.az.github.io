'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import type { OrderStatus } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

const STATUSES: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'PENDING', label: 'Onay Bekliyor' },
  { value: 'CONFIRMED', label: 'Onaylandı' },
  { value: 'SHIPPED', label: 'Kargoda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
  { value: 'CANCELLED', label: 'İptal' },
];

interface AdminOrderRow {
  id: string;
  code: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  customer: { name: string; mobile: string };
  createdAt: string;
  trackingNumber: string | null;
}

interface ListResponse {
  items: AdminOrderRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', { status, search, page }],
    queryFn: async () => {
      const { data } = await api.get<ListResponse>('/admin/orders', {
        params: {
          status: status || undefined,
          search: search || undefined,
          page,
          limit: 25,
        },
      });
      return data;
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Sipariş kodu, ad veya telefon ara"
          className="rounded border bg-transparent px-3 py-1.5 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as any);
            setPage(1);
          }}
          className="rounded border bg-transparent px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="rounded-lg border overflow-x-auto"
        style={{ borderColor: 'var(--aksioma-border)' }}
      >
        <table className="w-full text-sm">
          <thead
            className="text-xs uppercase"
            style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}
          >
            <tr>
              <th className="text-left p-2">Sipariş Kodu</th>
              <th className="text-left p-2">Müşteri</th>
              <th className="text-right p-2">Ürün</th>
              <th className="text-right p-2">Toplam</th>
              <th className="text-left p-2">Durum</th>
              <th className="text-left p-2">Tarih</th>
              <th className="text-left p-2">Kargo</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {data?.items.map((o) => (
              <tr
                key={o.id}
                className="border-t"
                style={{ borderColor: 'var(--aksioma-border)' }}
              >
                <td className="p-2 font-mono">{o.code}</td>
                <td className="p-2">
                  <div className="font-medium">{o.customer.name}</div>
                  <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                    {o.customer.mobile}
                  </div>
                </td>
                <td className="p-2 text-right">{o.itemCount}</td>
                <td className="p-2 text-right font-semibold">{TRY(o.total)}</td>
                <td className="p-2">
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="p-2 text-xs">
                  {new Date(o.createdAt).toLocaleString('tr-TR')}
                </td>
                <td className="p-2 font-mono text-xs">{o.trackingNumber ?? '—'}</td>
                <td className="p-2 text-right">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-xs rounded border px-2 py-1"
                    style={{ borderColor: 'var(--aksioma-border)' }}
                  >
                    Aç
                  </Link>
                </td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Sipariş bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--aksioma-muted)' }}>
            Toplam {data.total} sipariş · Sayfa {data.page}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              ← Önceki
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!data.hasMore}
              className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
