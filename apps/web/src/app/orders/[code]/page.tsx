'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import type { OrderDetail } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

export default function OrderDetailPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm">Yükleniyor…</div>}>
      <OrderDetailInner code={params.code} />
    </Suspense>
  );
}

function OrderDetailInner({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === '1';
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (user === null) router.replace(`/login?next=/orders/${code}`);
  }, [user, router, code]);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', code],
    queryFn: async () => (await api.get<OrderDetail>(`/orders/${code}`)).data,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  if (!user) return <div className="py-12 text-center text-sm">Yönlendiriliyor…</div>;
  if (isLoading) return <div className="py-12 text-center text-sm">Yükleniyor…</div>;
  if (error || !order)
    return <div className="py-12 text-center text-sm">Sipariş bulunamadı.</div>;

  return (
    <div className="flex flex-col gap-4">
      {success && (
        <div className="rounded-lg border border-green-500/40 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-800 dark:text-green-200">
          Siparişiniz başarıyla oluşturuldu! Sipariş numaranız:{' '}
          <span className="font-mono font-bold">{order.code}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Link href="/orders" className="text-sm underline" style={{ color: 'var(--aksioma-muted)' }}>
            ← Siparişlerim
          </Link>
          <h1 className="text-2xl font-bold mt-1">Sipariş {order.code}</h1>
          <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
            {new Date(order.createdAt).toLocaleString('tr-TR')}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex flex-col gap-3">
          <OrderTimeline events={order.events} />

          {order.trackingNumber && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
            >
              <div className="font-semibold mb-1">Kargo Takip</div>
              <div className="font-mono">{order.trackingNumber}</div>
              {order.carrier && (
                <div className="text-xs mt-1" style={{ color: 'var(--aksioma-muted)' }}>
                  {order.carrier}
                </div>
              )}
            </div>
          )}

          <div
            className="rounded-lg border"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            <div className="p-3 border-b font-semibold" style={{ borderColor: 'var(--aksioma-border)' }}>
              Ürünler
            </div>
            <div className="flex flex-col">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 border-b last:border-b-0 text-sm"
                  style={{ borderColor: 'var(--aksioma-border)' }}
                >
                  {item.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.image} alt="" className="w-14 h-14 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.slug}`} className="line-clamp-2 hover:underline">
                      {item.name}
                    </Link>
                    <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                      {item.quantity} × {TRY(item.unitPrice)}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{TRY(item.lineTotal)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            <div className="font-semibold mb-2">Özet</div>
            <div className="text-sm flex justify-between">
              <span>Ara toplam</span>
              <span>{TRY(order.subtotal)}</span>
            </div>
            <div className="text-sm flex justify-between">
              <span>Kargo</span>
              <span>{order.shippingFee > 0 ? TRY(order.shippingFee) : 'Ücretsiz'}</span>
            </div>
            <div
              className="border-t pt-2 mt-2 flex justify-between font-bold"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              <span>Toplam</span>
              <span>{TRY(order.total)}</span>
            </div>
          </div>

          {order.shippingAddress && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
            >
              <div className="font-semibold mb-1">Teslimat</div>
              <div>{order.shippingAddress.fullName}</div>
              <div style={{ color: 'var(--aksioma-muted)' }}>
                {order.shippingAddress.addressLine}
                {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}
                {order.shippingAddress.city ? `, ${order.shippingAddress.city}` : ''}
                {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ''}
              </div>
              {order.contactPhone && <div className="mt-1">Tel: {order.contactPhone}</div>}
            </div>
          )}

          {order.notes && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
            >
              <div className="font-semibold mb-1">Not</div>
              <div style={{ color: 'var(--aksioma-muted)' }}>{order.notes}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
