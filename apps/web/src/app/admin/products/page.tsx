'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerTier } from '@/lib/types';

interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  isVisible: boolean;
  category: { id: string; name: string; slug: string };
  unit: { code: string; name: string } | null;
  image: string | null;
  prices: { tier: CustomerTier; price: number }[];
  updatedAt: string;
}

interface AdminListResponse {
  items: AdminProductRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface Category { id: string; name: string; slug: string }

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', { search, categoryId, visibility, page }],
    queryFn: async () => {
      const { data } = await api.get<AdminListResponse>('/products/admin/list', {
        params: {
          search: search || undefined,
          categoryId: categoryId || undefined,
          visibility,
          page,
          limit: 25,
        },
      });
      return data;
    },
  });

  const toggleVisibility = async (p: AdminProductRow) => {
    setBusy(p.id);
    try {
      await api.patch(`/products/${p.id}/visibility`, { isVisible: !p.isVisible });
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Güncellenemedi.');
    } finally {
      setBusy(null);
    }
  };

  const deleteProduct = async (p: AdminProductRow) => {
    if (!confirm(`"${p.name}" ürününü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    setBusy(p.id);
    try {
      await api.delete(`/products/${p.id}`);
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Silinemedi.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ad, SKU veya barkod ara"
          className="rounded border bg-transparent px-3 py-1.5 text-sm flex-1 min-w-[200px]"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="rounded border bg-transparent px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          <option value="">Tüm kategoriler</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={visibility}
          onChange={(e) => { setVisibility(e.target.value as any); setPage(1); }}
          className="rounded border bg-transparent px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          <option value="all">Tümü</option>
          <option value="visible">Görünür</option>
          <option value="hidden">Gizli</option>
        </select>
        <Link
          href="/admin/products/new"
          className="rounded bg-accent text-white px-4 py-1.5 text-sm font-medium"
        >
          + Yeni Ürün
        </Link>
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--aksioma-border)' }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
            <tr>
              <th className="text-left p-2">Ürün</th>
              <th className="text-left p-2">SKU / Barkod</th>
              <th className="text-left p-2">Kategori</th>
              <th className="text-right p-2">Stok</th>
              <th className="text-right p-2">Std. Fiyat</th>
              <th className="text-left p-2">Durum</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-4 text-center">Yükleniyor…</td></tr>
            )}
            {data?.items.map((p) => {
              const std = p.prices.find((x) => x.tier === 'STANDARD');
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {p.image && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.image} alt="" className="w-10 h-10 rounded object-cover" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[260px]">{p.name}</div>
                        {p.unit && (
                          <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                            Birim: {p.unit.code}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 font-mono text-xs">
                    {p.sku ?? '—'}
                    <br />
                    <span style={{ color: 'var(--aksioma-muted)' }}>{p.barcode ?? '—'}</span>
                  </td>
                  <td className="p-2">{p.category.name}</td>
                  <td className="p-2 text-right">{p.stockQty}</td>
                  <td className="p-2 text-right">
                    {std ? `₺${std.price.toFixed(2)}` : '—'}
                  </td>
                  <td className="p-2">
                    {p.isVisible ? (
                      <span className="text-xs font-semibold rounded px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Görünür
                      </span>
                    ) : (
                      <span className="text-xs font-semibold rounded px-2 py-0.5 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        Gizli
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="text-xs rounded border px-2 py-1"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        Düzenle
                      </Link>
                      <button
                        onClick={() => toggleVisibility(p)}
                        disabled={busy === p.id}
                        className="text-xs rounded border px-2 py-1 disabled:opacity-50"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        {p.isVisible ? 'Gizle' : 'Göster'}
                      </button>
                      <button
                        onClick={() => deleteProduct(p)}
                        disabled={busy === p.id}
                        className="text-xs rounded border px-2 py-1 text-red-600 disabled:opacity-50"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Ürün bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--aksioma-muted)' }}>
            Toplam {data.total} ürün · Sayfa {data.page}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              ← Önceki
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!data.hasMore}
              className="rounded border px-3 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
