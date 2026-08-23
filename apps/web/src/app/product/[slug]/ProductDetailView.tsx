'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { PriceTag } from '@/components/product/PriceTag';
import { Countdown } from '@/components/product/Countdown';
import { track } from '@/lib/track';
import type { ProductDetail } from '@/lib/types';

export default function ProductDetailView({
  slug,
  initial,
}: {
  slug: string;
  initial: ProductDetail;
}) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: product } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/products/${slug}`);
      return data;
    },
    initialData: initial,
    refetchOnMount: 'always',
  });

  const productId = product?.id;

  useEffect(() => {
    if (!productId) return;
    const start = Date.now();
    track('PRODUCT_VIEW', { productId });
    return () => {
      track('PRODUCT_CLICK', {
        productId,
        payload: { dwellMs: Date.now() - start },
      });
    };
  }, [productId]);

  if (!product) return <div className="py-12 text-center">Ürün bulunamadı.</div>;

  const onAdd = async () => {
    setBusy(true);
    try {
      await add(product.id, qty);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Sepete eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const mainImage = product.images?.[0];
  const flashSale = product.price.flashSale;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
        {mainImage && (
          <Image
            src={mainImage}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        )}
        {flashSale && (
          <span className="absolute top-3 left-3 text-xs font-bold rounded px-2 py-1 bg-red-600 text-white uppercase tracking-wider">
            ⚡ Flash Fırsat
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div
          className="text-xs uppercase tracking-wide"
          style={{ color: 'var(--aksioma-muted)' }}
        >
          {product.category.name}
        </div>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <PriceTag price={product.price} unit={product.unit} large />

        {flashSale && (
          <div className="rounded-lg border-2 border-red-500/40 bg-red-50 dark:bg-red-900/20 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-semibold text-red-600 dark:text-red-300">
              Bu fiyat sınırlı bir süre için!
            </div>
            <Countdown endsAt={flashSale.endsAt} />
          </div>
        )}

        {product.description && (
          <p className="text-sm opacity-90">{product.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <div
            className="flex items-center border rounded"
            style={{ borderColor: 'var(--aksioma-border)' }}
          >
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-9 h-9"
            >
              −
            </button>
            <span className="w-10 text-center">{qty}</span>
            <button
              onClick={() => setQty(Math.min(product.stockQty, qty + 1))}
              className="w-9 h-9"
            >
              +
            </button>
          </div>
          <button
            onClick={onAdd}
            disabled={busy || product.stockQty < 1}
            className="flex-1 rounded bg-accent text-white py-3 font-medium disabled:opacity-50 hover:opacity-90"
          >
            {product.stockQty < 1 ? 'Stokta yok' : 'Sepete Ekle'}
          </button>
        </div>

        {product.isLowStock && product.lowStockTag && (
          <div className="text-sm font-medium text-accent">
            {product.lowStockTag}
          </div>
        )}

        <dl
          className="text-xs grid grid-cols-2 gap-2 mt-4 pt-4 border-t"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          {product.sku && (
            <>
              <dt className="opacity-70">SKU</dt>
              <dd>{product.sku}</dd>
            </>
          )}
          {product.barcode && (
            <>
              <dt className="opacity-70">Barkod</dt>
              <dd>{product.barcode}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
