'use client';

import { useEffect, useState } from 'react';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function format(msLeft: number) {
  if (msLeft <= 0) return null;
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

export function Countdown({
  endsAt,
  compact = false,
  onExpire,
}: {
  endsAt: string;
  compact?: boolean;
  onExpire?: () => void;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(endsAt).getTime();
  const left = format(end - now);

  useEffect(() => {
    if (left === null && onExpire) onExpire();
  }, [left, onExpire]);

  if (!left) return null;

  if (compact) {
    return (
      <span className="font-mono text-xs">
        {left.days > 0 ? `${left.days}g ` : ''}
        {pad(left.hours)}:{pad(left.minutes)}:{pad(left.seconds)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 font-mono">
      {left.days > 0 && (
        <>
          <span className="px-2 py-1 rounded bg-black/80 text-white text-sm font-bold">
            {pad(left.days)}
          </span>
          <span className="text-xs opacity-70">g</span>
        </>
      )}
      <span className="px-2 py-1 rounded bg-black/80 text-white text-sm font-bold">
        {pad(left.hours)}
      </span>
      <span className="opacity-70">:</span>
      <span className="px-2 py-1 rounded bg-black/80 text-white text-sm font-bold">
        {pad(left.minutes)}
      </span>
      <span className="opacity-70">:</span>
      <span className="px-2 py-1 rounded bg-black/80 text-white text-sm font-bold">
        {pad(left.seconds)}
      </span>
    </div>
  );
}
