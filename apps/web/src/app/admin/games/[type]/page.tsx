'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type GameType = 'DAILY_CHECKIN' | 'SPIN_WHEEL' | 'SCRATCH_CARD';
type RewardType =
  | 'DISCOUNT_PERCENT'
  | 'DISCOUNT_FIXED'
  | 'FREE_SHIPPING'
  | 'POINTS'
  | 'COUPON_CODE'
  | 'NOTHING';

interface Reward {
  id: string;
  label: string;
  type: RewardType;
  value: number | null;
  weight: number;
  couponCode: string | null;
  isEnabled: boolean;
  probability: number;
}

interface AdminGameDetail {
  id: string;
  type: GameType;
  isEnabled: boolean;
  config: { cooldownHours?: number; maxPlaysPerDay?: number };
  rewards: Reward[];
  _count: { plays: number };
}

const REWARD_TYPES: RewardType[] = [
  'DISCOUNT_PERCENT',
  'DISCOUNT_FIXED',
  'FREE_SHIPPING',
  'POINTS',
  'COUPON_CODE',
  'NOTHING',
];

const REWARD_LABEL: Record<RewardType, string> = {
  DISCOUNT_PERCENT: '% İndirim',
  DISCOUNT_FIXED: '₺ İndirim',
  FREE_SHIPPING: 'Ücretsiz Kargo',
  POINTS: 'Puan',
  COUPON_CODE: 'Kupon',
  NOTHING: 'Boş',
};

const TYPE_PARAM_TO_ENUM = (s: string) => s.toUpperCase().replace(/-/g, '_') as GameType;
const TITLE: Record<GameType, string> = {
  DAILY_CHECKIN: 'Günlük Giriş',
  SPIN_WHEEL: 'Çarkı Çevir',
  SCRATCH_CARD: 'Kazı Kazan',
};

export default function AdminGameDetailPage({ params }: { params: { type: string } }) {
  const type = TYPE_PARAM_TO_ENUM(params.type);
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'game', type],
    queryFn: async () =>
      (await api.get<AdminGameDetail>(`/admin/games/${type}`)).data,
  });

  const updateGame = async (patch: Partial<{ isEnabled: boolean; cooldownHours: number; maxPlaysPerDay: number }>) => {
    try {
      await api.patch(`/admin/games/${type}`, patch);
      qc.invalidateQueries({ queryKey: ['admin', 'game', type] });
      qc.invalidateQueries({ queryKey: ['admin', 'games'] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Güncellenemedi.');
    }
  };

  const saveReward = async (id: string | null, body: Omit<Reward, 'id' | 'probability'>) => {
    try {
      if (id) {
        await api.put(`/admin/games/rewards/${id}`, body);
      } else {
        await api.post(`/admin/games/${type}/rewards`, body);
      }
      qc.invalidateQueries({ queryKey: ['admin', 'game', type] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Kaydedilemedi.');
    }
  };

  const deleteReward = async (id: string) => {
    if (!confirm('Bu ödülü silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/admin/games/rewards/${id}`);
      qc.invalidateQueries({ queryKey: ['admin', 'game', type] });
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Silinemedi.');
    }
  };

  if (isLoading || !data) return <div className="py-8 text-center">Yükleniyor…</div>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/games" className="text-sm underline w-fit">← Oyunlara dön</Link>
      <h2 className="font-bold text-lg">{TITLE[type]}</h2>

      <section
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <h3 className="font-semibold text-sm">Yapılandırma</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.isEnabled}
            onChange={(e) => updateGame({ isEnabled: e.target.checked })}
          />
          Oyun aktif
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberField
            label="Bekleme süresi (saat)"
            value={data.config.cooldownHours ?? 0}
            onCommit={(v) => updateGame({ cooldownHours: v })}
          />
          <NumberField
            label="Günlük maksimum oynama"
            value={data.config.maxPlaysPerDay ?? 0}
            onCommit={(v) => updateGame({ maxPlaysPerDay: v })}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
          Toplam oynama: {data._count.plays}
        </p>
      </section>

      <section
        className="rounded-lg border p-4 flex flex-col gap-3"
        style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Ödüller</h3>
          <NewRewardButton
            onAdd={(r) =>
              saveReward(null, { ...r, isEnabled: true })
            }
          />
        </div>
        <RewardsTable rewards={data.rewards} onSave={saveReward} onDelete={deleteReward} />
        <p className="text-xs" style={{ color: 'var(--aksioma-muted)' }}>
          Olasılıklar yalnızca aktif (isEnabled) ödüllerin ağırlıkları üzerinden hesaplanır.
        </p>
      </section>

      {err && <div className="text-sm text-accent">{err}</div>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const [v, setV] = useState(String(value));
  return (
    <label className="block text-xs">
      <span className="block mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n !== value) onCommit(n);
        }}
        className="w-full rounded border bg-transparent px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--aksioma-border)' }}
      />
    </label>
  );
}

function NewRewardButton({
  onAdd,
}: {
  onAdd: (r: { label: string; type: RewardType; value: number | null; weight: number; couponCode: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<RewardType>('DISCOUNT_PERCENT');
  const [value, setValue] = useState('');
  const [weight, setWeight] = useState('10');
  const [couponCode, setCouponCode] = useState('');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-accent text-white px-3 py-1 text-xs font-medium"
      >
        + Ödül Ekle
      </button>
    );
  }

  return (
    <div className="w-full mt-2 grid gap-2 grid-cols-1 md:grid-cols-6 items-end">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Etiket"
        className="rounded border bg-transparent px-2 py-1 text-xs md:col-span-2"
        style={{ borderColor: 'var(--aksioma-border)' }}
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as RewardType)}
        className="rounded border bg-transparent px-2 py-1 text-xs"
        style={{ borderColor: 'var(--aksioma-border)' }}
      >
        {REWARD_TYPES.map((t) => (
          <option key={t} value={t}>{REWARD_LABEL[t]}</option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Değer"
        className="rounded border bg-transparent px-2 py-1 text-xs"
        style={{ borderColor: 'var(--aksioma-border)' }}
      />
      <input
        type="number"
        min={0}
        step={1}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="Ağırlık"
        className="rounded border bg-transparent px-2 py-1 text-xs"
        style={{ borderColor: 'var(--aksioma-border)' }}
      />
      <input
        value={couponCode}
        onChange={(e) => setCouponCode(e.target.value)}
        placeholder="Kupon kodu (ops.)"
        className="rounded border bg-transparent px-2 py-1 text-xs md:col-span-2"
        style={{ borderColor: 'var(--aksioma-border)' }}
      />
      <div className="flex gap-1 md:col-span-6">
        <button
          onClick={() => {
            if (!label.trim()) return;
            onAdd({
              label: label.trim(),
              type,
              value: value === '' ? null : Number(value),
              weight: Math.max(0, Math.floor(Number(weight) || 0)),
              couponCode: couponCode.trim() || null,
            });
            setOpen(false);
            setLabel('');
            setValue('');
            setWeight('10');
            setCouponCode('');
          }}
          className="rounded bg-accent text-white px-3 py-1 text-xs"
        >
          Ekle
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded border px-3 py-1 text-xs"
          style={{ borderColor: 'var(--aksioma-border)' }}
        >
          İptal
        </button>
      </div>
    </div>
  );
}

function RewardsTable({
  rewards,
  onSave,
  onDelete,
}: {
  rewards: Reward[];
  onSave: (id: string, body: Omit<Reward, 'id' | 'probability'>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded border" style={{ borderColor: 'var(--aksioma-border)' }}>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase" style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-muted)' }}>
          <tr>
            <th className="text-left p-2">Etiket</th>
            <th className="text-left p-2">Tür</th>
            <th className="text-right p-2">Değer</th>
            <th className="text-right p-2">Ağırlık</th>
            <th className="text-left p-2">Kupon Kodu</th>
            <th className="text-right p-2">Olasılık</th>
            <th className="text-center p-2">Aktif</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rewards.map((r) => <RewardRow key={r.id} reward={r} onSave={onSave} onDelete={onDelete} />)}
          {rewards.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-center" style={{ color: 'var(--aksioma-muted)' }}>
                Henüz ödül yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RewardRow({
  reward,
  onSave,
  onDelete,
}: {
  reward: Reward;
  onSave: (id: string, body: Omit<Reward, 'id' | 'probability'>) => void;
  onDelete: (id: string) => void;
}) {
  const [edit, setEdit] = useState<null | Omit<Reward, 'id' | 'probability'>>(null);
  if (!edit) {
    return (
      <tr className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
        <td className="p-2">{reward.label}</td>
        <td className="p-2 text-xs"><code>{reward.type}</code></td>
        <td className="p-2 text-right">{reward.value ?? '—'}</td>
        <td className="p-2 text-right font-mono">{reward.weight}</td>
        <td className="p-2 font-mono text-xs">{reward.couponCode ?? '—'}</td>
        <td className="p-2 text-right font-bold">{reward.probability.toFixed(2)}%</td>
        <td className="p-2 text-center">{reward.isEnabled ? '✓' : '✕'}</td>
        <td className="p-2 text-right">
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => setEdit({ label: reward.label, type: reward.type, value: reward.value, weight: reward.weight, couponCode: reward.couponCode, isEnabled: reward.isEnabled })}
              className="text-xs rounded border px-2 py-0.5"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              Düzenle
            </button>
            <button
              onClick={() => onDelete(reward.id)}
              className="text-xs rounded border px-2 py-0.5 text-red-600"
              style={{ borderColor: 'var(--aksioma-border)' }}
            >
              Sil
            </button>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
      <td className="p-2">
        <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} className="w-full rounded border bg-transparent px-2 py-1 text-xs" style={{ borderColor: 'var(--aksioma-border)' }} />
      </td>
      <td className="p-2">
        <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as RewardType })} className="rounded border bg-transparent px-1 py-1 text-xs" style={{ borderColor: 'var(--aksioma-border)' }}>
          {REWARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="p-2 text-right">
        <input type="number" step="0.01" value={edit.value ?? ''} onChange={(e) => setEdit({ ...edit, value: e.target.value === '' ? null : Number(e.target.value) })} className="w-20 rounded border bg-transparent px-1 py-1 text-xs text-right" style={{ borderColor: 'var(--aksioma-border)' }} />
      </td>
      <td className="p-2 text-right">
        <input type="number" min={0} step={1} value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="w-16 rounded border bg-transparent px-1 py-1 text-xs text-right" style={{ borderColor: 'var(--aksioma-border)' }} />
      </td>
      <td className="p-2">
        <input value={edit.couponCode ?? ''} onChange={(e) => setEdit({ ...edit, couponCode: e.target.value || null })} className="w-full rounded border bg-transparent px-1 py-1 text-xs font-mono" style={{ borderColor: 'var(--aksioma-border)' }} />
      </td>
      <td className="p-2 text-right">—</td>
      <td className="p-2 text-center">
        <input type="checkbox" checked={edit.isEnabled} onChange={(e) => setEdit({ ...edit, isEnabled: e.target.checked })} />
      </td>
      <td className="p-2 text-right">
        <div className="flex gap-1 justify-end">
          <button onClick={() => { onSave(reward.id, edit); setEdit(null); }} className="text-xs rounded bg-accent text-white px-2 py-0.5">Kaydet</button>
          <button onClick={() => setEdit(null)} className="text-xs rounded border px-2 py-0.5" style={{ borderColor: 'var(--aksioma-border)' }}>İptal</button>
        </div>
      </td>
    </tr>
  );
}
