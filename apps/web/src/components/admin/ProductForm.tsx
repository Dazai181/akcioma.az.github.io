'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerTier } from '@/lib/types';

interface Category { id: string; name: string; slug: string }
interface UnitOption { id: string; code: string; name: string }

export interface ProductFormInitial {
  id?: string;
  name?: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string;
  unit?: { code: string } | null;
  stockQty?: number;
  isVisible?: boolean;
  prices?: { tier: CustomerTier; price: number }[];
  images?: { url: string; isPrimary: boolean }[];
}

const TIERS: CustomerTier[] = ['STANDARD', 'FAVORITE', 'SPECIAL'];

export function ProductForm({ initial }: { initial?: ProductFormInitial }) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [barcode, setBarcode] = useState(initial?.barcode ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [unitCode, setUnitCode] = useState(initial?.unit?.code ?? '');
  const [stockQty, setStockQty] = useState<number | string>(initial?.stockQty ?? 0);
  const [isVisible, setIsVisible] = useState(initial?.isVisible ?? true);

  const initStd = initial?.prices?.find((p) => p.tier === 'STANDARD')?.price ?? '';
  const initFav = initial?.prices?.find((p) => p.tier === 'FAVORITE')?.price ?? '';
  const initSpec = initial?.prices?.find((p) => p.tier === 'SPECIAL')?.price ?? '';
  const [stdPrice, setStdPrice] = useState<number | string>(initStd);
  const [favPrice, setFavPrice] = useState<number | string>(initFav);
  const [specPrice, setSpecPrice] = useState<number | string>(initSpec);

  const [imageUrlsRaw, setImageUrlsRaw] = useState(
    initial?.images?.map((i) => i.url).join('\n') ?? '',
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<Category[]>('/categories')).data,
  });
  const units = useQuery({
    queryKey: ['units'],
    queryFn: async () => (await api.get<UnitOption[]>('/units')).data,
  });

  useEffect(() => {
    // If creating and we have categories, default to first one.
    if (!categoryId && categories.data?.length) setCategoryId(categories.data[0].id);
  }, [categories.data, categoryId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const stdNum = Number(stdPrice);
    if (!Number.isFinite(stdNum) || stdNum < 0) {
      setErr('Standart fiyat zorunludur ve sıfırdan büyük olmalıdır.');
      return;
    }
    if (!categoryId) {
      setErr('Kategori seçiniz.');
      return;
    }

    const prices: { tier: CustomerTier; price: number }[] = [
      { tier: 'STANDARD', price: stdNum },
    ];
    if (favPrice !== '' && Number.isFinite(Number(favPrice))) {
      prices.push({ tier: 'FAVORITE', price: Number(favPrice) });
    }
    if (specPrice !== '' && Number.isFinite(Number(specPrice))) {
      prices.push({ tier: 'SPECIAL', price: Number(specPrice) });
    }

    const imageUrls = imageUrlsRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && /^https?:\/\//i.test(s));

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      categoryId,
      unitCode: unitCode.trim() || undefined,
      stockQty: Math.max(0, Math.floor(Number(stockQty) || 0)),
      isVisible,
      prices,
      imageUrls: imageUrls.length ? imageUrls : undefined,
    };

    setBusy(true);
    try {
      if (isEdit) {
        await api.put(`/products/${initial!.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      router.push('/admin/products');
      router.refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setErr(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-3xl">
      <Section title="Temel Bilgiler">
        <Field label="Ad *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="input"
          />
        </Field>
        <Field label="Açıklama">
          <textarea
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="SKU">
            <input value={sku ?? ''} onChange={(e) => setSku(e.target.value)} maxLength={64} className="input" />
          </Field>
          <Field label="Barkod">
            <input value={barcode ?? ''} onChange={(e) => setBarcode(e.target.value)} maxLength={64} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Kategori *">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="input">
              <option value="">— Seçiniz —</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Birim (kod)">
            <input
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              list="unit-codes"
              className="input"
              placeholder="adet, kg, lt…"
            />
            <datalist id="unit-codes">
              {units.data?.map((u) => (
                <option key={u.id} value={u.code}>{u.name}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Stok adedi *">
            <input
              type="number"
              min={0}
              step={1}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Fiyatlandırma">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Standart fiyat * (₺)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={stdPrice}
              onChange={(e) => setStdPrice(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="VIP fiyat (₺)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={favPrice}
              onChange={(e) => setFavPrice(e.target.value)}
              className="input"
              placeholder="—"
            />
          </Field>
          <Field label="Özel fiyat (₺)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={specPrice}
              onChange={(e) => setSpecPrice(e.target.value)}
              className="input"
              placeholder="—"
            />
          </Field>
        </div>
        <p className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
          Standart fiyat strikethrough olarak gösterilecek "orijinal" fiyattır. VIP/Özel boş bırakılırsa o seviyedeki kullanıcılar Standart fiyatı görür.
        </p>
      </Section>

      <Section title="Görseller">
        <Field label="Görsel URL'leri (her satıra bir tane, https://…)">
          <textarea
            value={imageUrlsRaw}
            onChange={(e) => setImageUrlsRaw(e.target.value)}
            rows={3}
            placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
            className="input font-mono text-xs"
          />
        </Field>
      </Section>

      <Section title="Görünürlük">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
          <span>Mağazada görünür</span>
        </label>
      </Section>

      {err && <div className="text-sm text-accent">{err}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-accent text-white px-5 py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri Kaydet' : 'Ürünü Oluştur'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/products')}
          className="rounded border px-5 py-2"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          İptal
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid var(--aksioma-border);
          background: transparent;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: inherit;
        }
        .input:focus {
          outline: 2px solid var(--aksioma-accent);
          outline-offset: -1px;
        }
      `}</style>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
    >
      <h3 className="font-semibold text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium">
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  );
}
