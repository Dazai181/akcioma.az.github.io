'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';
import type { ProductListResponse } from '@/lib/types';

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const sentinel = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    queryKey: ['products', 'category', slug],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<ProductListResponse>('/products', {
        params: { page: pageParam, limit: 24, category: slug },
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bold text-xl capitalize">{slug.replace(/-/g, ' ')}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <div ref={sentinel} className="h-12 flex items-center justify-center text-sm" style={{ color: 'var(--aksioma-muted)' }}>
        {isFetching ? 'Yükleniyor…' : hasNextPage ? '' : items.length > 0 ? 'Hepsi bu kadar.' : 'Bu kategoride ürün yok.'}
      </div>
    </div>
  );
}
