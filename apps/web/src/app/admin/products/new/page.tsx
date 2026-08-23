'use client';

import Link from 'next/link';
import { ProductForm } from '@/components/admin/ProductForm';

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/products" className="text-sm underline w-fit">← Ürün listesine dön</Link>
      <h2 className="font-bold text-lg">Yeni Ürün</h2>
      <ProductForm />
    </div>
  );
}
