'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type EventType =
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CLICK'
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'CART_ABANDON'
  | 'SEARCH'
  | 'CHECKOUT_START'
  | 'CHECKOUT_COMPLETE';

interface Summary {
  activeSessions: number;
  totalEvents: number;
  addToCart: number;
  checkoutStart: number;
  sinceDays: number;
}

interface FunnelRow {
  step: EventType;
  uniques: number;
  total: number;
}

interface TopProduct {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  count: number;
}

interface RecentEvent {
  id: string;
  type: EventType;
  createdAt: string;
  sessionId: string;
  user: { id: string; name: string; mobile?: string } | null;
  product: { id: string; name: string; slug: string } | null;
  payload: any;
}

interface AbandonedCart {
  cartId: string;
  user: { id: string; firstName: string; lastName: string; mobile: string } | null;
  isGuest: boolean;
  itemCount: number;
  subtotal: number;
  lastTouchedAt: string;
}

const FUNNEL_LABEL: Record<EventType, string> = {
  PRODUCT_VIEW: 'Ürün Görüntüleme',
  PRODUCT_CLICK: 'Ürün Tıklama',
  ADD_TO_CART: 'Sepete Ekleme',
  REMOVE_FROM_CART: 'Sepetten Çıkarma',
  CART_ABANDON: 'Sepet Terk',
  SEARCH: 'Arama',
  CHECKOUT_START: 'Ödeme Başlat',
  CHECKOUT_COMPLETE: 'Ödeme Tamamla',
};

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(7);

  const summary = useQuery({
    queryKey: ['admin', 'analytics', 'summary', days],
    queryFn: async () =>
      (await api.get<Summary>('/admin/analytics/summary', { params: { days } })).data,
  });

  const funnel = useQuery({
    queryKey: ['admin', 'analytics', 'funnel', days],
    queryFn: async () =>
      (await api.get<FunnelRow[]>('/admin/analytics/funnel', { params: { days } })).data,
  });

  const topViewed = useQuery({
    queryKey: ['admin', 'analytics', 'top', 'PRODUCT_VIEW', days],
    queryFn: async () =>
      (
        await api.get<TopProduct[]>('/admin/analytics/top-products', {
          params: { days, type: 'PRODUCT_VIEW' },
        })
      ).data,
  });

  const topAddedToCart = useQuery({
    queryKey: ['admin', 'analytics', 'top', 'ADD_TO_CART', days],
    queryFn: async () =>
      (
        await api.get<TopProduct[]>('/admin/analytics/top-products', {
          params: { days, type: 'ADD_TO_CART' },
        })
      ).data,
  });

  const recent = useQuery({
    queryKey: ['admin', 'analytics', 'recent'],
    queryFn: async () =>
      (await api.get<RecentEvent[]>('/admin/analytics/recent-events')).data,
    refetchInterval: 10_000,
  });

  const abandoned = useQuery({
    queryKey: ['admin', 'analytics', 'abandoned'],
    queryFn: async () =>
      (await api.get<AbandonedCart[]>('/admin/analytics/abandoned-carts', { params: { hours: 1 } })).data,
  });

  const topOfFunnel = funnel.data?.[0]?.uniques ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>Dönem:</span>
        {[1, 7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-xs rounded px-3 py-1.5 border ${
              days === d ? 'border-accent text-accent font-semibold' : ''
            }`}
            style={{ borderColor: days === d ? 'var(--aksioma-accent)' : 'var(--aksioma-border)' }}
          >
            {d === 1 ? '24s' : `${d} gün`}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Aktif Oturum" value={summary.data?.activeSessions ?? '—'} />
        <Stat label="Toplam Olay" value={summary.data?.totalEvents ?? '—'} />
        <Stat label="Sepete Eklemeler" value={summary.data?.addToCart ?? '—'} />
        <Stat label="Ödeme Başlatma" value={summary.data?.checkoutStart ?? '—'} />
      </div>

      {/* Funnel */}
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-bold mb-3">Dönüşüm Hunisi</h2>
        <div className="flex flex-col gap-2">
          {funnel.data?.map((row, idx) => {
            const pct = topOfFunnel > 0 ? (row.uniques / topOfFunnel) * 100 : 0;
            const prevUniques = idx > 0 ? funnel.data![idx - 1].uniques : null;
            const stepConversion =
              prevUniques != null && prevUniques > 0
                ? Math.round((row.uniques / prevUniques) * 1000) / 10
                : null;
            return (
              <div key={row.step} className="flex items-center gap-3">
                <div className="w-40 text-xs">{FUNNEL_LABEL[row.step]}</div>
                <div className="flex-1 h-7 rounded relative overflow-hidden" style={{ background: 'var(--aksioma-border)' }}>
                  <div
                    className="absolute inset-y-0 left-0 bg-accent flex items-center px-2 text-white text-xs font-bold"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  >
                    {row.uniques}
                  </div>
                </div>
                <div className="w-20 text-right text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                  {stepConversion != null ? `${stepConversion}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopProductsCard title="En Çok Görüntülenen" rows={topViewed.data ?? []} />
        <TopProductsCard title="En Çok Sepete Eklenen" rows={topAddedToCart.data ?? []} />
      </div>

      {/* Abandoned carts */}
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-bold mb-3">Terkedilmiş Sepetler (1+ saat)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase" style={{ color: 'var(--aksioma-muted)' }}>
              <tr>
                <th className="text-left p-2">Müşteri</th>
                <th className="text-right p-2">Ürün</th>
                <th className="text-right p-2">Tutar</th>
                <th className="text-right p-2">Son Etkileşim</th>
              </tr>
            </thead>
            <tbody>
              {abandoned.data?.map((c) => (
                <tr key={c.cartId} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                  <td className="p-2">
                    {c.isGuest ? (
                      <span style={{ color: 'var(--aksioma-muted)' }}>Misafir</span>
                    ) : (
                      <>
                        {c.user?.firstName} {c.user?.lastName}
                        <div className="text-xs font-mono" style={{ color: 'var(--aksioma-muted)' }}>{c.user?.mobile}</div>
                      </>
                    )}
                  </td>
                  <td className="p-2 text-right">{c.itemCount}</td>
                  <td className="p-2 text-right font-bold">₺{c.subtotal.toFixed(2)}</td>
                  <td className="p-2 text-right text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                    {new Date(c.lastTouchedAt).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
              {abandoned.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                    Şu anda terkedilmiş sepet yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent activity */}
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-bold mb-3">Son Aktivite (canlı)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase" style={{ color: 'var(--aksioma-muted)' }}>
              <tr>
                <th className="text-left p-2">Zaman</th>
                <th className="text-left p-2">Tür</th>
                <th className="text-left p-2">Kullanıcı</th>
                <th className="text-left p-2">Ürün</th>
                <th className="text-left p-2">Ek</th>
              </tr>
            </thead>
            <tbody>
              {recent.data?.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                  <td className="p-2 whitespace-nowrap text-xs">
                    {new Date(e.createdAt).toLocaleTimeString('tr-TR')}
                  </td>
                  <td className="p-2"><code className="text-[10px]">{e.type}</code></td>
                  <td className="p-2 text-xs">
                    {e.user ? e.user.name : <span style={{ color: 'var(--aksioma-muted)' }}>· {e.sessionId}</span>}
                  </td>
                  <td className="p-2 text-xs">
                    {e.product ? (
                      <Link href={`/product/${e.product.slug}`} className="underline">{e.product.name}</Link>
                    ) : '—'}
                  </td>
                  <td className="p-2 text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                    {e.payload?.dwellMs ? `${Math.round(e.payload.dwellMs / 100) / 10}s` : ''}
                    {e.payload?.quantity ? ` ×${e.payload.quantity}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <div className="text-xs uppercase" style={{ color: 'var(--aksioma-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function TopProductsCard({ title, rows }: { title: string; rows: TopProduct[] }) {
  const max = rows[0]?.count ?? 0;
  return (
    <section
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <h2 className="font-bold mb-3">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>Veri yok.</div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const pct = max > 0 ? (r.count / max) * 100 : 0;
            return (
              <li key={r.productId} className="flex items-center gap-2">
                <span className="text-xs w-5 text-right font-mono">{i + 1}.</span>
                {r.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.image} alt="" className="w-8 h-8 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${r.slug}`} className="text-sm hover:underline truncate block">
                    {r.name}
                  </Link>
                  <div className="h-1.5 rounded mt-1" style={{ background: 'var(--aksioma-border)' }}>
                    <div className="h-full rounded bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs font-mono font-bold w-10 text-right">{r.count}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
