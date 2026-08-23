import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ProductDetail } from '@/lib/types';
import ProductDetailView from './ProductDetailView';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const SITE_NAME = 'Aksioma Stationery';

async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ProductDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  if (!product) {
    return { title: `Ürün bulunamadı — ${SITE_NAME}` };
  }
  const title = `${product.name} — ${SITE_NAME}`;
  const description =
    product.description?.slice(0, 160) ??
    `${product.name} satın al · ${product.category.name}`;
  const images =
    Array.isArray(product.images) && product.images.length
      ? product.images.slice(0, 4).map((url) => ({ url }))
      : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: SITE_NAME,
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await fetchProduct(params.slug);
  if (!product) notFound();
  return <ProductDetailView slug={params.slug} initial={product} />;
}
