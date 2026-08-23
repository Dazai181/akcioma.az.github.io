'use client';

import { useCart } from '@/lib/cart-store';

export function CartIcon() {
  const itemCount = useCart((s) => s.cart?.itemCount ?? 0);
  const open = useCart((s) => s.openDrawer);
  return (
    <button
      onClick={open}
      aria-label="Sepeti aç"
      className="relative rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
    >
      <span aria-hidden className="text-xl">🛒</span>
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
}
