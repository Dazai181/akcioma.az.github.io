'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';
import { FlashSaleRail } from '@/components/product/FlashSaleRail';
import { useAuth } from '@/lib/auth-store';
import type { FlashSaleAdminItem, ProductListResponse, ProductSummary } from '@/lib/types';

export default function Home() {
  const user = useAuth((s) => s.user);
  const sentinel = useRef<HTMLDivElement>(null);

  const flashSales = useQuery({
    queryKey: ['flash-sales', 'public'],
    queryFn: async () =>
      (await api.get<FlashSaleAdminItem[]>('/flash-sales')).data,
    staleTime: 30_000,
  });

  const recommended = useQuery({
    queryKey: ['products', 'recommended', user?.id ?? 'guest'],
    queryFn: async () =>
      (await api.get<ProductSummary[]>('/products/recommended')).data,
    staleTime: 60_000,
  });

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    queryKey: ['products', 'feed'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<ProductListResponse>('/products', {
        params: { page: pageParam, limit: 24 },
      });
      return data;
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetching) fetchNextPage();
      },
      { rootMargin: '300px' },
    );
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const recommendedItems = recommended.data ?? [];
  const recommendedTitle = user
    ? 'Senin İçin Seçtiklerimiz'
    : 'Trend Ürünler';
  const sales = flashSales.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-gradient-to-br from-primary to-accent text-white p-6">
        <h1 className="text-2xl font-bold">Aksioma Stationery</h1>
        <p className="opacity-90 text-sm mt-1">Ofis malzemeleri ve kırtasiye — sana özel fiyatlarla.</p>
      </section>

      {sales.length > 0 && <FlashSaleRail sales={sales} />}

      {recommendedItems.length > 0 && (
        <section>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <span>✨</span> {recommendedTitle}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recommendedItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-bold text-lg mb-3">Tüm Ürünler</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <div ref={sentinel} className="h-12 flex items-center justify-center text-sm" style={{ color: 'var(--aksioma-muted)' }}>
          {isFetching ? 'Yükleniyor…' : hasNextPage ? '' : items.length > 0 ? 'Hepsi bu kadar.' : ''}
        </div>
      </section>
    </div>
  );
}
