'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type GameType = 'DAILY_CHECKIN' | 'SPIN_WHEEL' | 'SCRATCH_CARD';

interface AdminGame {
  id: string;
  type: GameType;
  isEnabled: boolean;
  config: { cooldownHours?: number; maxPlaysPerDay?: number };
  rewards: { id: string; isEnabled: boolean; weight: number; probability: number }[];
  _count: { plays: number; rewards: number };
}

const LABEL: Record<GameType, string> = {
  DAILY_CHECKIN: 'Günlük Giriş',
  SPIN_WHEEL: 'Çarkı Çevir',
  SCRATCH_CARD: 'Kazı Kazan',
};

export default function AdminGamesIndex() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'games'],
    queryFn: async () => (await api.get<AdminGame[]>('/admin/games')).data,
  });

  const toggle = async (g: AdminGame) => {
    try {
      await api.patch(`/admin/games/${g.type}`, { isEnabled: !g.isEnabled });
      qc.invalidateQueries({ queryKey: ['admin', 'games'] });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Güncellenemedi.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <div className="text-sm">Yükleniyor…</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data?.map((g) => {
          const enabledRewards = g.rewards.filter((r) => r.isEnabled).length;
          return (
            <div
              key={g.type}
              className="rounded-lg border p-4 flex flex-col gap-2"
              style={{ borderColor: 'var(--aksioma-border)', background: 'var(--aksioma-card)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">{LABEL[g.type]}</h3>
                  <code className="text-[10px] uppercase" style={{ color: 'var(--aksioma-muted)' }}>
                    {g.type}
                  </code>
                </div>
                <button
                  onClick={() => toggle(g)}
                  className={`text-xs font-semibold rounded px-3 py-1.5 ${
                    g.isEnabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {g.isEnabled ? 'Aktif' : 'Pasif'}
                </button>
              </div>
              <div className="text-sm grid grid-cols-3 gap-2 mt-1">
                <Stat label="Ödül" value={`${enabledRewards}/${g.rewards.length}`} />
                <Stat label="Oynanan" value={g._count.plays} />
                <Stat label="Bekleme" value={g.config.cooldownHours ? `${g.config.cooldownHours}s` : '—'} />
              </div>
              <Link
                href={`/admin/games/${g.type.toLowerCase().replace(/_/g, '-')}`}
                className="text-xs underline w-fit mt-1"
              >
                Yapılandır →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase" style={{ color: 'var(--aksioma-muted)' }}>{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
