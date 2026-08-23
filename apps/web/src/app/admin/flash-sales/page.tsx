'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FlashSaleAdminItem } from '@/lib/types';

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  prices: { tier: 'STANDARD' | 'FAVORITE' | 'SPECIAL'; price: number }[];
}

function fmtLocal(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart() {
  return fmtLocal(new Date());
}
function defaultEnd() {
  return fmtLocal(new Date(Date.now() + 86_400_000));
}

export default function AdminFlashSalesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'expired'>('all');

  const { data: sales, isLoading } = useQuery({
    queryKey: ['admin', 'flash-sales', filter],
    queryFn: async () => {
      const { data } = await api.get<FlashSaleAdminItem[]>('/flash-sales/admin', {
        params: { filter },
      });
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/flash-sales/${id}`, { isActive });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flash-sales'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/flash-sales/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'flash-sales'] }),
  });

  const onDelete = async (s: FlashSaleAdminItem) => {
    if (!confirm(`"${s.productName}" için kampanyayı silmek istediğinize emin misiniz?`)) return;
    remove.mutate(s.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <CreateFlashSaleForm />

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'upcoming', 'expired'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-3 py-1 text-sm ${
              filter === f ? 'bg-accent text-white border-transparent' : ''
            }`}
            style={filter === f ? undefined : { borderColor: 'var(--aksioma-border)' }}
          >
            {(
              { all: 'Tümü', active: 'Aktif', upcoming: 'Yaklaşan', expired: 'Süresi Dolmuş' } as const
            )[f]}
          </button>
        ))}
      </div>

      <div
        className="rounded-lg border overflow-x-auto"
        style={{ borderColor: 'var(--aksioma-border)' }}
      >
        <table className="w-full text-sm">
          <thead
            className="text-xs uppercase"
            style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}
          >
            <tr>
              <th className="text-left p-2">Ürün</th>
              <th className="text-right p-2">Std. Fiyat</th>
              <th className="text-right p-2">Kampanya Fiyatı</th>
              <th className="text-right p-2">İndirim</th>
              <th className="text-left p-2">Başlangıç</th>
              <th className="text-left p-2">Bitiş</th>
              <th className="text-left p-2">Durum</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {sales?.map((s) => {
              const off =
                s.standardPrice && s.standardPrice > 0
                  ? Math.round((1 - s.salePrice / s.standardPrice) * 100)
                  : 0;
              return (
                <tr
                  key={s.id}
                  className="border-t"
                  style={{ borderColor: 'var(--aksioma-border)' }}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {s.productImage && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.productImage} alt="" className="w-10 h-10 rounded object-cover" />
                      )}
                      <a href={`/product/${s.productSlug}`} className="font-medium underline-offset-2 hover:underline">
                        {s.productName}
                      </a>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    {s.standardPrice ? `₺${s.standardPrice.toFixed(2)}` : '—'}
                  </td>
                  <td className="p-2 text-right font-semibold text-accent">
                    ₺{s.salePrice.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">{off > 0 ? `−${off}%` : '—'}</td>
                  <td className="p-2 text-xs">{new Date(s.startsAt).toLocaleString('tr-TR')}</td>
                  <td className="p-2 text-xs">{new Date(s.endsAt).toLocaleString('tr-TR')}</td>
                  <td className="p-2">
                    {s.isActive ? (
                      <span className="text-xs font-semibold rounded px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-xs font-semibold rounded px-2 py-0.5 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        Devre Dışı
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => toggle.mutate({ id: s.id, isActive: !s.isActive })}
                        className="text-xs rounded border px-2 py-1"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        {s.isActive ? 'Durdur' : 'Aktifleştir'}
                      </button>
                      <button
                        onClick={() => onDelete(s)}
                        className="text-xs rounded border px-2 py-1 text-red-600"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sales?.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateFlashSaleForm() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const [salePrice, setSalePrice] = useState<string>('');
  const [startsAt, setStartsAt] = useState<string>(defaultStart());
  const [endsAt, setEndsAt] = useState<string>(defaultEnd());
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['admin', 'flash-sales', 'search', search],
    queryFn: async () => {
      const { data } = await api.get<{
        items: ProductOption[];
      }>('/products/admin/list', {
        params: { search: search || undefined, limit: 8, visibility: 'visible' },
      });
      return data.items;
    },
    enabled: search.length >= 2,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Ürün seçin.');
      const price = Number(salePrice);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Geçerli bir fiyat girin.');
      await api.post('/flash-sales', {
        productId: selected.id,
        salePrice: price,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        isActive: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'flash-sales'] });
      setSelected(null);
      setSearch('');
      setSalePrice('');
      setStartsAt(defaultStart());
      setEndsAt(defaultEnd());
      setError(null);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? e?.message ?? 'Oluşturulamadı.');
    },
  });

  const stdPrice = selected?.prices.find((p) => p.tier === 'STANDARD')?.price ?? null;

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <h2 className="font-bold text-lg">Yeni Flash Fırsat</h2>

      {!selected && (
        <div className="flex flex-col gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara (en az 2 karakter)…"
            className="rounded border bg-transparent px-3 py-1.5 text-sm"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          {results.data && results.data.length > 0 && (
            <div
              className="rounded border max-h-60 overflow-y-auto"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              {results.data.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="block w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 border-b last:border-b-0"
                  style={{ borderColor: 'var(--aksioma-border)' }}
                >
                  <span className="font-medium">{p.name}</span>{' '}
                  {p.sku && (
                    <span className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
                      ({p.sku})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <span className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
                Seçilen ürün:
              </span>{' '}
              <span className="font-medium">{selected.name}</span>
              {stdPrice != null && (
                <span className="ml-2 text-sm" style={{ color: 'var(--aksioma-muted)' }}>
                  (Std: ₺{stdPrice.toFixed(2)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs rounded border px-2 py-1"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              Değiştir
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col text-sm gap-1">
              <span style={{ color: 'var(--aksioma-muted)' }}>Kampanya fiyatı (₺)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="rounded border bg-transparent px-3 py-1.5"
                style={{ borderColor: 'var(--aksioma-border)' }}
              />
            </label>
            <label className="flex flex-col text-sm gap-1">
              <span style={{ color: 'var(--aksioma-muted)' }}>Başlangıç</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="rounded border bg-transparent px-3 py-1.5"
                style={{ borderColor: 'var(--aksioma-border)' }}
              />
            </label>
            <label className="flex flex-col text-sm gap-1">
              <span style={{ color: 'var(--aksioma-muted)' }}>Bitiş</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded border bg-transparent px-3 py-1.5"
                style={{ borderColor: 'var(--aksioma-border)' }}
              />
            </label>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="rounded bg-accent text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {create.isPending ? 'Kaydediliyor…' : 'Kampanya Oluştur'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
