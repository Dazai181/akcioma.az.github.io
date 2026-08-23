'use client';

import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Temayı değiştir"
      className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
    >
      <span aria-hidden className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
