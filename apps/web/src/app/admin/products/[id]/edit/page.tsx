'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProductForm, ProductFormInitial } from '@/components/admin/ProductForm';

export default function EditProductPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'product', params.id],
    queryFn: async () => {
      const { data } = await api.get<ProductFormInitial & { id: string }>(
        `/products/admin/${params.id}`,
      );
      return data;
    },
  });

  if (isLoading) return <div className="py-8 text-center">Yükleniyor…</div>;
  if (error || !data) return <div className="py-8 text-center">Ürün bulunamadı.</div>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="text-sm underline w-fit">← Ürün listesine dön</Link>
      <h2 className="font-bold text-lg">Ürünü Düzenle: {data.name}</h2>
      <ProductForm initial={data} />
    </div>
  );
}
