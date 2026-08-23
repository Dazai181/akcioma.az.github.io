'use client';

import type { PlayResult } from '@/lib/game-types';

const REWARD_ICON: Record<string, string> = {
  DISCOUNT_PERCENT: '🏷️',
  DISCOUNT_FIXED: '💸',
  FREE_SHIPPING: '🚚',
  POINTS: '⭐',
  COUPON_CODE: '🎟️',
  NOTHING: '🎈',
};

const HEADLINE: Record<string, string> = {
  DISCOUNT_PERCENT: 'Tebrikler!',
  DISCOUNT_FIXED: 'Tebrikler!',
  FREE_SHIPPING: 'Süper!',
  POINTS: 'Puan kazandınız!',
  COUPON_CODE: 'Bir kupon!',
  NOTHING: 'Bu sefer şanslı değildiniz',
};

export function RewardModal({
  result,
  onClose,
}: {
  result: PlayResult;
  onClose: () => void;
}) {
  const r = result.reward;
  const isWin = r.type !== 'NOTHING';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl shadow-2xl max-w-sm w-full p-6 text-center flex flex-col gap-3"
        style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-fg)' }}
      >
        <div className="text-5xl" aria-hidden>{REWARD_ICON[r.type] ?? '🎁'}</div>
        <h2 className="font-bold text-xl">{HEADLINE[r.type] ?? 'Ödül'}</h2>
        <p className="text-2xl font-bold text-accent">{r.label}</p>
        {r.couponCode && isWin && (
          <div
            className="rounded border border-dashed py-2 px-3 text-sm font-mono select-all"
            style={{ borderColor: 'var(--aksioma-accent)' }}
          >
            <span className="block text-xs mb-1" style={{ color: 'var(--aksioma-muted)' }}>
              Kupon kodunuz
            </span>
            <span className="font-bold tracking-wider">{r.couponCode}</span>
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-2 rounded bg-accent text-white py-2 font-medium"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}
