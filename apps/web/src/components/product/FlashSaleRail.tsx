'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { FlashSaleAdminItem } from '@/lib/types';
import { Countdown } from './Countdown';

function discountPercent(standard: number | null, sale: number) {
  if (!standard || standard <= 0) return 0;
  return Math.round((1 - sale / standard) * 100);
}

export function FlashSaleRail({ sales }: { sales: FlashSaleAdminItem[] }) {
  if (sales.length === 0) return null;
  const soonest = sales.reduce((a, b) =>
    new Date(a.endsAt).getTime() < new Date(b.endsAt).getTime() ? a : b,
  );

  return (
    <section className="rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <span>⚡</span> Flash Fırsatlar
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: 'var(--aksioma-muted)' }}>En yakın bitiş:</span>
          <Countdown endsAt={soonest.endsAt} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sales.map((s) => {
          const off = discountPercent(s.standardPrice, s.salePrice);
          return (
            <Link
              key={s.id}
              href={`/product/${s.productSlug}`}
              className="rounded-lg overflow-hidden border bg-white dark:bg-gray-900 block transition hover:shadow-lg"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                {s.productImage && (
                  <Image
                    src={s.productImage}
                    alt={s.productName}
                    fill
                    sizes="(max-width: 768px) 50vw, 16vw"
                    className="object-cover"
                  />
                )}
                {off > 0 && (
                  <span className="absolute top-2 right-2 text-xs font-bold rounded px-2 py-1 bg-red-600 text-white">
                    −{off}%
                  </span>
                )}
                <div className="absolute bottom-1 left-1 right-1 flex justify-center">
                  <div className="bg-black/70 text-white rounded px-2 py-1">
                    <Countdown endsAt={s.endsAt} compact />
                  </div>
                </div>
              </div>
              <div className="p-2 flex flex-col gap-0.5">
                <div className="text-xs line-clamp-2 min-h-[2rem]">{s.productName}</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-accent">₺{s.salePrice.toFixed(2)}</span>
                  {s.standardPrice && (
                    <span
                      className="text-xs line-through"
                      style={{ color: 'var(--aksioma-muted)' }}
                    >
                      ₺{s.standardPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
