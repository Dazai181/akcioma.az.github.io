'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { PlayResult, PublicGameView } from '@/lib/game-types';
import { RewardModal } from './RewardModal';

const SLICE_COLORS = [
  '#e8593c', '#1a3a5c', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export function SpinWheel() {
  const user = useAuth((s) => s.user);
  const [view, setView] = useState<PublicGameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);

  useEffect(() => {
    api
      .get<PublicGameView>('/games/spin-wheel')
      .then((r) => setView(r.data))
      .catch((e) => setError(e?.response?.data?.message ?? 'Oyun yüklenemedi.'));
  }, []);

  const onSpin = async () => {
    if (!user) {
      setError('Çevirmek için giriş yapmalısınız.');
      return;
    }
    if (!view || spinning) return;
    setError(null);
    setSpinning(true);
    try {
      const { data } = await api.post<PlayResult>('/games/spin-wheel/play');
      // Animate the wheel to land on the won slice. We rotate the wheel
      // anti-clockwise so the won slice ends under the top pointer.
      const slices = view.rewards.length;
      const sliceAngle = 360 / slices;
      // Pointer is at top (12 o'clock = -90deg from x-axis). We want
      // the center of the chosen slice to align with the pointer.
      const targetSliceCenter = data.rewardIndex * sliceAngle + sliceAngle / 2;
      // Rotate so that targetSliceCenter ends up at angle 0 (top).
      // Final visual rotation = -targetSliceCenter mod 360, plus some
      // full revolutions for drama.
      const finalRotation = 360 * 6 + (360 - targetSliceCenter);
      setAngle((prev) => prev + finalRotation - (prev % 360));
      // Show modal after the CSS transition finishes (~4s).
      setTimeout(() => {
        setResult(data);
        setSpinning(false);
        // Refetch state so cooldown updates.
        api.get<PublicGameView>('/games/spin-wheel').then((r) => setView(r.data));
      }, 4200);
    } catch (e: any) {
      setSpinning(false);
      setError(e?.response?.data?.message ?? 'Çevirme başarısız.');
    }
  };

  if (!view) {
    return <div className="py-8 text-center text-sm">Yükleniyor…</div>;
  }
  if (!view.isEnabled) {
    return <div className="py-8 text-center text-sm" style={{ color: 'var(--aksioma-muted)' }}>Bu oyun şu anda aktif değil.</div>;
  }
  if (view.rewards.length === 0) {
    return <div className="py-8 text-center text-sm">Henüz ödül tanımlanmamış.</div>;
  }

  const slices = view.rewards.length;
  const sliceAngle = 360 / slices;
  const radius = 140;
  const cx = 150;
  const cy = 150;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 300, height: 300 }}>
        {/* Pointer */}
        <div
          aria-hidden
          className="absolute z-10 top-[-6px] left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '20px solid var(--aksioma-accent)',
          }}
        />
        {/* Wheel */}
        <svg
          width={300}
          height={300}
          viewBox="0 0 300 300"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.16, 1.0)' : 'none',
          }}
        >
          {view.rewards.map((r, i) => {
            const start = (i * sliceAngle - 90) * (Math.PI / 180);
            const end = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
            const x1 = cx + radius * Math.cos(start);
            const y1 = cy + radius * Math.sin(start);
            const x2 = cx + radius * Math.cos(end);
            const y2 = cy + radius * Math.sin(end);
            const largeArc = sliceAngle > 180 ? 1 : 0;
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
            const labelAngle = ((i + 0.5) * sliceAngle - 90) * (Math.PI / 180);
            const lx = cx + radius * 0.62 * Math.cos(labelAngle);
            const ly = cy + radius * 0.62 * Math.sin(labelAngle);
            return (
              <g key={r.id}>
                <path d={path} fill={SLICE_COLORS[i % SLICE_COLORS.length]} stroke="white" strokeWidth={2} />
                <text
                  x={lx}
                  y={ly}
                  fill="white"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  transform={`rotate(${(i + 0.5) * sliceAngle} ${lx} ${ly})`}
                >
                  {r.label.length > 14 ? r.label.slice(0, 12) + '…' : r.label}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={20} fill="white" />
        </svg>
      </div>

      {!user ? (
        <div className="text-sm text-center" style={{ color: 'var(--aksioma-muted)' }}>
          Çevirmek için <a href="/login" className="underline">giriş yapın</a>.
        </div>
      ) : !view.canPlay && view.cooldownEndsAt ? (
        <CooldownTimer until={view.cooldownEndsAt} />
      ) : (
        <button
          onClick={onSpin}
          disabled={spinning || !view.canPlay}
          className="rounded-full bg-accent text-white px-8 py-3 font-bold text-lg disabled:opacity-50"
        >
          {spinning ? 'Çevriliyor…' : 'Çevir!'}
        </button>
      )}

      {error && <div className="text-sm text-accent">{error}</div>}

      {result && <RewardModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function CooldownTimer({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <div className="text-sm">Hazır!</div>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <div className="text-sm" style={{ color: 'var(--aksioma-muted)' }}>
      Tekrar çevirebilmek için: <span className="font-mono font-bold">{h}s {m}d {s}sn</span>
    </div>
  );
}
