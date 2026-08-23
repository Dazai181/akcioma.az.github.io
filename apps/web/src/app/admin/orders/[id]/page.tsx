'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import type { OrderDetail, OrderStatus } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Onay Bekliyor',
  CONFIRMED: 'Onayla',
  SHIPPED: 'Kargoya Ver',
  DELIVERED: 'Teslim Edildi olarak işaretle',
  CANCELLED: 'İptal Et',
};

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'order', params.id],
    queryFn: async () =>
      (await api.get<OrderDetail>(`/admin/orders/${params.id}`)).data,
  });

  const update = useMutation({
    mutationFn: async (payload: {
      status: OrderStatus;
      trackingNumber?: string;
      carrier?: string;
      note?: string;
    }) => {
      const { data } = await api.patch<OrderDetail>(
        `/admin/orders/${params.id}/status`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'order', params.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setNote('');
      setErr(null);
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.message ?? 'Güncellenemedi.');
    },
  });

  if (isLoading) return <div className="py-12 text-center text-sm">Yükleniyor…</div>;
  if (!order) return <div className="py-12 text-center text-sm">Sipariş bulunamadı.</div>;

  const transitions = NEXT_STATUSES[order.status];
  const shippedConfirmed = ['SHIPPED', 'DELIVERED'].includes(order.status);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/orders" className="text-sm underline" style={{ color: 'var(--aksioma-muted)' }}>
        ← Tüm siparişler
      </Link>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Sipariş {order.code}</h1>
          <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
            {new Date(order.createdAt).toLocaleString('tr-TR')}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 flex flex-col gap-3">
          <OrderTimeline events={order.events} />

          <div
            className="rounded-lg border p-4 flex flex-col gap-3"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            <div className="font-semibold">Sipariş Yönetimi</div>

            {(order.status === 'SHIPPED' || order.status === 'CONFIRMED') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-sm flex flex-col gap-1">
                  <span style={{ color: 'var(--aksioma-muted)' }}>Takip Numarası</span>
                  <input
                    value={trackingNumber || order.trackingNumber || ''}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="rounded border bg-transparent px-3 py-1.5"
                    style={{ borderColor: 'var(--aksioma-border)' }}
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span style={{ color: 'var(--aksioma-muted)' }}>Kargo Firması</span>
                  <input
                    value={carrier || order.carrier || ''}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="rounded border bg-transparent px-3 py-1.5"
                    style={{ borderColor: 'var(--aksioma-border)' }}
                  />
                </label>
              </div>
            )}

            <label className="text-sm flex flex-col gap-1">
              <span style={{ color: 'var(--aksioma-muted)' }}>Not (isteğe bağlı)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded border bg-transparent px-3 py-1.5"
                style={{ borderColor: 'var(--aksioma-border)' }}
              />
            </label>

            {err && <div className="text-sm text-red-600">{err}</div>}

            <div className="flex flex-wrap gap-2">
              {transitions.length === 0 && (
                <span className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
                  Bu sipariş için yapılacak başka bir işlem yok.
                </span>
              )}
              {transitions.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    update.mutate({
                      status: s,
                      trackingNumber: trackingNumber || undefined,
                      carrier: carrier || undefined,
                      note: note || undefined,
                    })
                  }
                  disabled={update.isPending}
                  className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    s === 'CANCELLED'
                      ? 'border text-red-600'
                      : 'bg-accent text-white'
                  }`}
                  style={s === 'CANCELLED' ? { borderColor: 'var(--aksioma-border)' } : undefined}
                >
                  {LABELS[s]}
                </button>
              ))}
            </div>

            {shippedConfirmed && (
              <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                Kargo bilgilerini güncellemek için yeni durum değişikliği yapmadan da yukarıdaki
                alanları doldurup bir sonraki adıma geçebilirsiniz.
              </div>
            )}
          </div>

          <div
            className="rounded-lg border"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            <div className="p-3 border-b font-semibold" style={{ borderColor: 'var(--aksioma-border)' }}>
              Ürünler
            </div>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 border-b last:border-b-0 text-sm"
                style={{ borderColor: 'var(--aksioma-border)' }}
              >
                {item.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.image} alt="" className="w-12 h-12 rounded object-cover" />
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

        <aside className="flex flex-col gap-3">
          {order.customer && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
            >
              <div className="font-semibold mb-1">Müşteri</div>
              <div>{order.customer.name}</div>
              <div style={{ color: 'var(--aksioma-muted)' }}>{order.customer.mobile}</div>
              <div className="text-xs mt-1">
                Tier:{' '}
                <span className="font-semibold">{order.customer.tier}</span>
              </div>
            </div>
          )}

          <div
            className="rounded-lg border p-3 text-sm"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            <div className="font-semibold mb-2">Özet</div>
            <div className="flex justify-between">
              <span>Ara toplam</span>
              <span>{TRY(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
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
              <div className="font-semibold mb-1">Müşteri Notu</div>
              <div style={{ color: 'var(--aksioma-muted)' }}>{order.notes}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
