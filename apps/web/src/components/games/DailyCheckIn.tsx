'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { PlayResult, PublicGameView } from '@/lib/game-types';
import { RewardModal } from './RewardModal';

export function DailyCheckIn() {
  const user = useAuth((s) => s.user);
  const [view, setView] = useState<PublicGameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);

  const refresh = () => {
    api
      .get<PublicGameView>('/games/daily-checkin')
      .then((r) => setView(r.data))
      .catch((e) => setError(e?.response?.data?.message ?? 'Yüklenemedi.'));
  };

  useEffect(() => { refresh(); }, []);

  const onClaim = async () => {
    if (!user) {
      setError('Almak için giriş yapmalısınız.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<PlayResult>('/games/daily-checkin/play');
      setResult(data);
      refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Alınamadı.');
    } finally {
      setBusy(false);
    }
  };

  if (!view) return null;
  if (!view.isEnabled) {
    return (
      <div className="text-sm text-center py-6" style={{ color: 'var(--aksioma-muted)' }}>
        Günlük giriş ödülü şu anda aktif değil.
      </div>
    );
  }

  const canClaim = view.canPlay && !view.cooldownEndsAt;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-2xl p-6 text-center max-w-md w-full"
        style={{ background: 'var(--aksioma-card)', border: '1px solid var(--aksioma-border)' }}
      >
        <div className="text-5xl mb-2" aria-hidden>🎁</div>
        <h3 className="font-bold text-lg mb-1">Günlük Hediyeniz</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--aksioma-muted)' }}>
          Her gün giriş yaparak puan, indirim ve ücretsiz kargo kazanın.
        </p>
        {!user ? (
          <a href="/login" className="inline-block rounded bg-accent text-white px-6 py-2 font-medium">
            Giriş Yap
          </a>
        ) : canClaim ? (
          <button
            onClick={onClaim}
            disabled={busy}
            className="rounded bg-accent text-white px-6 py-2 font-medium disabled:opacity-50"
          >
            {busy ? 'Alınıyor…' : 'Bugünkü Hediyemi Al'}
          </button>
        ) : view.cooldownEndsAt ? (
          <CooldownText until={view.cooldownEndsAt} />
        ) : (
          <div className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
            Bugünlük hak doldu. Yarın tekrar deneyin!
          </div>
        )}
      </div>
      {error && <div className="text-sm text-accent">{error}</div>}
      {result && <RewardModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function CooldownText({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <div className="text-sm">Hazır!</div>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return (
    <div className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
      Sonraki ödül: <span className="font-mono font-bold">{h}s {m}d</span>
    </div>
  );
}
