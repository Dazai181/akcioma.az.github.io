'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cart-store';
import type { ProductSummary } from '@/lib/types';
import { PriceTag } from './PriceTag';
import { Countdown } from './Countdown';

export function ProductCard({ product }: { product: ProductSummary }) {
  const add = useCart((s) => s.add);
  const image = typeof product.images === 'string' ? product.images : null;

  const onAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await add(product.id, 1);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Sepete eklenemedi.');
    }
  };

  const flashSale = product.price.flashSale;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="rounded-lg overflow-hidden border block transition hover:shadow-lg"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
        {image && (
          <Image src={image} alt={product.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
        )}
        {flashSale && (
          <span className="absolute top-2 left-2 text-[10px] font-bold rounded px-2 py-1 bg-red-600 text-white uppercase tracking-wider">
            ⚡ Fırsat
          </span>
        )}
        {!flashSale && product.isLowStock && product.lowStockTag && (
          <span className="absolute top-2 left-2 text-xs font-bold rounded px-2 py-1 bg-accent text-white">
            {product.lowStockTag}
          </span>
        )}
        {product.price.discountPercent > 0 && (
          <span className="absolute top-2 right-2 text-xs font-bold rounded px-2 py-1 bg-primary text-white">
            −{product.price.discountPercent}%
          </span>
        )}
        {flashSale && (
          <div className="absolute bottom-2 left-2 right-2 flex justify-center">
            <div className="bg-black/70 text-white rounded px-2 py-1">
              <Countdown endsAt={flashSale.endsAt} compact />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="text-sm line-clamp-2 min-h-[2.5rem]">{product.name}</div>
        <PriceTag price={product.price} unit={product.unit} />
        <button
          onClick={onAdd}
          disabled={product.stockQty < 1}
          className="mt-1 w-full rounded bg-accent text-white text-sm font-medium py-2 disabled:opacity-50 hover:opacity-90"
        >
          {product.stockQty < 1 ? 'Stokta yok' : 'Sepete Ekle'}
        </button>
      </div>
    </Link>
  );
}
