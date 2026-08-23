'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UnitRow {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  createdAt: string;
  _count: { products: number };
}

export default function UnitsAdminPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'units'],
    queryFn: async () => {
      const { data } = await api.get<UnitRow[]>('/admin/units');
      return data;
    },
  });

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/admin/units', { code: code.trim(), name: name.trim() || undefined });
      setCode('');
      setName('');
      qc.invalidateQueries({ queryKey: ['admin', 'units'] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const onRename = async () => {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/admin/units/${editing.id}`, { name: editing.name });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin', 'units'] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" birimini silmek istediğinize emin misiniz?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/admin/units/${id}`);
      qc.invalidateQueries({ queryKey: ['admin', 'units'] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Silinemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h2 className="font-bold mb-2">Yeni Birim Ekle</h2>
        <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="kod (örn: kg)"
            className="rounded border bg-transparent px-3 py-1.5 text-sm flex-1 min-w-[120px]"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ad (örn: Kilogram)"
            className="rounded border bg-transparent px-3 py-1.5 text-sm flex-1 min-w-[160px]"
            style={{ borderColor: 'var(--aksioma-border)' }}
          />
          <button
            disabled={busy}
            className="rounded bg-accent text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Ekle
          </button>
        </form>
        <p className="text-xs mt-2" style={{ color: 'var(--aksioma-muted)' }}>
          Excel'den veya ERP'den gelen tanımsız birimler otomatik olarak eklenir.
        </p>
      </section>

      {err && (
        <div className="text-sm text-accent rounded border px-3 py-2" style={{ borderColor: 'var(--aksioma-border)' }}>
          {err}
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--aksioma-border)' }}>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
            <tr>
              <th className="text-left p-2">Kod</th>
              <th className="text-left p-2">Ad</th>
              <th className="text-left p-2">Tür</th>
              <th className="text-right p-2">Ürün Sayısı</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="p-4 text-center">Yükleniyor…</td></tr>
            )}
            {data?.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
                <td className="p-2 font-mono">{u.code}</td>
                <td className="p-2">
                  {editing?.id === u.id ? (
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      autoFocus
                      className="rounded border bg-transparent px-2 py-1 text-sm w-full"
                      style={{ borderColor: 'var(--aksioma-border)' }}
                    />
                  ) : (
                    u.name
                  )}
                </td>
                <td className="p-2">
                  {u.isSystem ? (
                    <span className="text-xs font-semibold rounded px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Sistem
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>—</span>
                  )}
                </td>
                <td className="p-2 text-right">{u._count.products}</td>
                <td className="p-2 text-right">
                  {editing?.id === u.id ? (
                    <div className="flex gap-1 justify-end">
                      <button onClick={onRename} disabled={busy} className="text-xs rounded bg-accent text-white px-2 py-1">
                        Kaydet
                      </button>
                      <button onClick={() => setEditing(null)} className="text-xs rounded border px-2 py-1" style={{ borderColor: 'var(--aksioma-border)' }}>
                        İptal
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditing({ id: u.id, name: u.name })}
                        className="text-xs rounded border px-2 py-1"
                        style={{ borderColor: 'var(--aksioma-border)' }}
                      >
                        Adı Düzenle
                      </button>
                      {!u.isSystem && (
                        <button
                          onClick={() => onDelete(u.id, u.name)}
                          disabled={busy || u._count.products > 0}
                          className="text-xs rounded border px-2 py-1 text-red-600 disabled:opacity-50"
                          style={{ borderColor: 'var(--aksioma-border)' }}
                          title={u._count.products > 0 ? 'Bu birim kullanımda — silinemez' : ''}
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                  Henüz birim yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
