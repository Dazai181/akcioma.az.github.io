'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import type { OrderListItem } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (user === null) router.replace('/login?next=/orders');
  }, [user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => (await api.get<OrderListItem[]>('/orders')).data,
    enabled: !!user,
  });

  if (!user) return <div className="py-12 text-center text-sm">Yönlendiriliyor…</div>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Siparişlerim</h1>
      {isLoading && <div className="text-sm">Yükleniyor…</div>}
      {data && data.length === 0 && (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--aksioma-muted)' }}>
          Henüz siparişiniz yok.{' '}
          <Link href="/" className="text-accent underline">
            Alışverişe başlayın
          </Link>
          .
        </div>
      )}
      <div className="flex flex-col gap-2">
        {data?.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.code}`}
            className="rounded-lg border p-3 flex items-center gap-3 hover:shadow"
            style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
          >
            {o.previewImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={o.previewImage} alt="" className="w-14 h-14 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm">{o.code}</div>
              <div className="text-xs line-clamp-1" style={{ color: 'var(--aksioma-muted)' }}>
                {o.itemCount} ürün · {o.previewName}
              </div>
              <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                {new Date(o.createdAt).toLocaleString('tr-TR')}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="font-bold">{TRY(o.total)}</div>
              <OrderStatusBadge status={o.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
