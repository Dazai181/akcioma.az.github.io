'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PriceRow { tier: 'STANDARD' | 'FAVORITE' | 'SPECIAL'; price: number }
interface ProductSnap {
  id?: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string;
  categorySlug?: string;
  unitCode?: string | null;
  stockQty: number;
  description?: string | null;
  prices: PriceRow[] | null;
}
interface ConflictDetail {
  id: string;
  status: 'UNRESOLVED' | 'KEPT_EXISTING' | 'KEPT_INCOMING' | 'MERGED';
  matchedBy: string;
  productId: string | null;
  existingData: ProductSnap | ProductSnap[];
  incomingData: ProductSnap;
  createdAt: string;
  notes?: string;
  job: { source: string; fileName?: string | null };
}

export default function ConflictDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'conflict', params.id],
    queryFn: async () => {
      const { data } = await api.get<ConflictDetail>(`/admin/conflicts/${params.id}`);
      return data;
    },
  });

  const [busy, setBusy] = useState<null | string>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  if (isLoading || !data) return <div className="py-8 text-center">Yükleniyor…</div>;

  const isAmbiguous = Array.isArray(data.existingData);
  const existingArr: ProductSnap[] = Array.isArray(data.existingData) ? data.existingData : [data.existingData];
  const incoming = data.incomingData;
  const resolved = data.status !== 'UNRESOLVED';

  const submit = async (action: 'KEEP_EXISTING' | 'APPLY_INCOMING' | 'MERGE', mergedData?: any) => {
    setBusy(action);
    setErr(null);
    try {
      await api.post(`/admin/conflicts/${data.id}/resolve`, {
        action,
        mergedData,
        notes: notes || undefined,
      });
      await refetch();
      router.push('/admin/conflicts');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Çözüm uygulanamadı.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/conflicts" className="text-sm underline">← Çakışma listesine dön</Link>

      <div className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
        Eşleşme yöntemi: <code>{data.matchedBy}</code> · Kaynak: {data.job.source}
        {data.job.fileName ? ` · ${data.job.fileName}` : ''} · Durum: <code>{data.status}</code>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SnapshotCard
          title={isAmbiguous ? `Mevcut (${existingArr.length} eşleşme)` : 'Mevcut Ürün'}
          ambiguous={isAmbiguous}
          snaps={existingArr}
        />
        <SnapshotCard title="Gelen Veri" snaps={[incoming]} highlight />
      </div>

      {!resolved && (
        <div className="flex flex-col gap-3 p-4 rounded-lg border" style={{ borderColor: 'var(--aksioma-border)' }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notlar (opsiyonel) — neden bu kararı verdiniz?"
            rows={2}
            className="w-full rounded border bg-transparent p-2 text-sm"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          {err && <div className="text-sm text-accent">{err}</div>}
          <div className="flex gap-2 flex-wrap">
            {!isAmbiguous && (
              <button
                onClick={() => submit('KEEP_EXISTING')}
                disabled={!!busy}
                className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--aksioma-border)' }}
              >
                Mevcudu Koru
              </button>
            )}
            <button
              onClick={() => submit('APPLY_INCOMING')}
              disabled={!!busy}
              className="rounded bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isAmbiguous ? 'Yeni Olarak Oluştur' : 'Geleni Uygula'}
            </button>
            <MergeButton incoming={incoming} existing={existingArr[0]} onApply={(merged) => submit('MERGE', merged)} disabled={!!busy} />
          </div>
        </div>
      )}

      {resolved && data.notes && (
        <div className="text-sm rounded border p-3" style={{ borderColor: 'var(--aksioma-border)' }}>
          <strong>Notlar:</strong> {data.notes}
        </div>
      )}
    </div>
  );
}

function SnapshotCard({
  title,
  snaps,
  ambiguous,
  highlight,
}: {
  title: string;
  snaps: ProductSnap[];
  ambiguous?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: highlight ? 'var(--aksioma-accent)' : 'var(--aksioma-border)',
        background: 'var(--aksioma-card)',
      }}
    >
      <h3 className="font-bold mb-2">{title}</h3>
      {snaps.map((s, i) => (
        <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t' : ''} style={{ borderColor: 'var(--aksioma-border)' }}>
          {ambiguous && <div className="text-xs mb-1" style={{ color: 'var(--aksioma-muted)' }}>Eşleşme #{i + 1}</div>}
          <Field k="Ad" v={s.name} />
          <Field k="SKU" v={s.sku} />
          <Field k="Barkod" v={s.barcode} />
          <Field k="Kategori" v={s.categorySlug ?? s.categoryId} />
          <Field k="Birim" v={s.unitCode} />
          <Field k="Stok" v={s.stockQty} />
          <Field k="Açıklama" v={s.description} />
          <Field k="Fiyatlar" v={
            s.prices?.map((p) => `${p.tier}: ₺${Number(p.price).toFixed(2)}`).join(' · ') ?? '—'
          } />
        </div>
      ))}
    </div>
  );
}

function Field({ k, v }: { k: string; v: any }) {
  if (v == null || v === '') return null;
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 text-xs py-0.5">
      <dt className="opacity-70">{k}</dt>
      <dd className="break-words">{String(v)}</dd>
    </div>
  );
}

function MergeButton({
  incoming,
  existing,
  onApply,
  disabled,
}: {
  incoming: ProductSnap;
  existing?: ProductSnap;
  onApply: (merged: any) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(incoming.name);
  const [stockQty, setStockQty] = useState(incoming.stockQty);
  const [categorySlug, setCategorySlug] = useState(incoming.categorySlug ?? '');
  const [unitCode, setUnitCode] = useState(incoming.unitCode ?? existing?.unitCode ?? '');
  const [description, setDescription] = useState(incoming.description ?? existing?.description ?? '');
  const [sku, setSku] = useState(incoming.sku ?? existing?.sku ?? '');
  const [barcode, setBarcode] = useState(incoming.barcode ?? existing?.barcode ?? '');
  const [prices, setPrices] = useState<PriceRow[]>(incoming.prices ?? existing?.prices ?? []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{ borderColor: 'var(--aksioma-border)' }}
      >
        Birleştir…
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-3 rounded border flex flex-col gap-2" style={{ borderColor: 'var(--aksioma-border)' }}>
      <h4 className="font-semibold text-sm">Alanları seç</h4>
      <Pickable label="Ad" existing={existing?.name} incoming={incoming.name} value={name} onChange={setName} />
      <Pickable label="Kategori slug" existing={existing?.categorySlug} incoming={incoming.categorySlug} value={categorySlug} onChange={setCategorySlug} />
      <Pickable label="Birim" existing={existing?.unitCode} incoming={incoming.unitCode} value={unitCode} onChange={setUnitCode} />
      <Pickable label="Stok" existing={existing?.stockQty} incoming={incoming.stockQty} value={stockQty} onChange={(v) => setStockQty(Number(v))} />
      <Pickable label="SKU" existing={existing?.sku} incoming={incoming.sku} value={sku} onChange={setSku} />
      <Pickable label="Barkod" existing={existing?.barcode} incoming={incoming.barcode} value={barcode} onChange={setBarcode} />
      <Pickable label="Açıklama" existing={existing?.description} incoming={incoming.description} value={description} onChange={setDescription} />
      <div className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
        Fiyatlar gelen veriden uygulanacak ({prices.map((p) => p.tier).join(', ')}).
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onApply({ name, stockQty, categorySlug, unitCode: unitCode || undefined, description, sku: sku || undefined, barcode: barcode || undefined, prices })}
          disabled={disabled}
          className="rounded bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Birleşmiş Veriyi Uygula
        </button>
        <button onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm" style={{ borderColor: 'var(--aksioma-border)' }}>
          İptal
        </button>
      </div>
    </div>
  );
}

function Pickable({
  label,
  existing,
  incoming,
  value,
  onChange,
}: {
  label: string;
  existing: any;
  incoming: any;
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-center text-xs">
      <span className="font-medium">{label}</span>
      <div className="flex gap-1">
        {existing != null && existing !== '' && (
          <button type="button" onClick={() => onChange(existing)} className="rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--aksioma-border)' }}>
            Mevcut: {String(existing).slice(0, 40)}
          </button>
        )}
        {incoming != null && incoming !== '' && (
          <button type="button" onClick={() => onChange(incoming)} className="rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--aksioma-accent)', color: 'var(--aksioma-accent)' }}>
            Gelen: {String(incoming).slice(0, 40)}
          </button>
        )}
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="ml-auto flex-1 rounded border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: 'var(--aksioma-border)' }}
        />
      </div>
    </div>
  );
}
