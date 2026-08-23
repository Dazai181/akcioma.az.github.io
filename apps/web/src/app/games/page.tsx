'use client';

import { SpinWheel } from '@/components/games/SpinWheel';
import { DailyCheckIn } from '@/components/games/DailyCheckIn';

export default function GamesPage() {
  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Hediyeler & Ödüller</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--aksioma-muted)' }}>
          Her gün gelin, çark çevirin, indirimler ve puanlar kazanın.
        </p>
      </header>

      <section
        className="rounded-2xl p-6"
        style={{ background: 'var(--aksioma-card)', border: '1px solid var(--aksioma-border)' }}
      >
        <h2 className="font-bold text-lg mb-4 text-center">🎡 Çarkı Çevir</h2>
        <SpinWheel />
      </section>

      <section
        className="rounded-2xl p-6"
        style={{ background: 'var(--aksioma-card)', border: '1px solid var(--aksioma-border)' }}
      >
        <DailyCheckIn />
      </section>
    </div>
  );
}
