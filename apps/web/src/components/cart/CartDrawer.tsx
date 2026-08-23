'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-store';
import { useAuth } from '@/lib/auth-store';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, fetch, update, remove } = useCart();
  const user = useAuth((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (drawerOpen && !cart) fetch();
  }, [drawerOpen, cart, fetch]);

  const goCheckout = () => {
    closeDrawer();
    if (!user) router.push('/login?next=/checkout');
    else router.push('/checkout');
  };

  return (
    <>
      <div
        onClick={closeDrawer}
        aria-hidden
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Alışveriş sepeti"
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 shadow-2xl flex flex-col transition-transform ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'var(--aksioma-card)', color: 'var(--aksioma-fg)' }}
      >
        <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--aksioma-border)' }}>
          <h2 className="font-bold text-lg">Sepetim ({cart?.itemCount ?? 0})</h2>
          <button onClick={closeDrawer} aria-label="Kapat" className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/10">
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {!cart || cart.items.length === 0 ? (
            <div className="text-center text-sm py-12" style={{ color: 'var(--aksioma-muted)' }}>
              Sepetiniz boş.
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 border rounded-lg p-3"
                style={{ borderColor: 'var(--aksioma-border)' }}
              >
                {item.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.image} alt="" className="w-16 h-16 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${item.slug}`} className="text-sm line-clamp-2 hover:underline">
                    {item.name}
                  </Link>
                  <div className="text-sm mt-1 text-accent font-semibold">
                    {TRY(item.priceSnapshot)}
                    {item.unit && (
                      <span className="ml-1 text-xs font-normal" style={{ color: 'var(--aksioma-muted)' }}>
                        / {item.unit.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => update(item.id, Math.max(1, item.quantity - 1))}
                      className="w-7 h-7 rounded border"
                      style={{ borderColor: 'var(--aksioma-border)' }}
                    >
                      −
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => update(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded border"
                      style={{ borderColor: 'var(--aksioma-border)' }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="ml-auto text-xs"
                      style={{ color: 'var(--aksioma-muted)' }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
                <div className="text-sm font-bold whitespace-nowrap">{TRY(item.lineTotal)}</div>
              </div>
            ))
          )}
        </div>

        <footer className="p-4 border-t" style={{ borderColor: 'var(--aksioma-border)' }}>
          <div className="flex justify-between text-sm mb-3">
            <span>Ara toplam</span>
            <span className="font-bold">{TRY(cart?.subtotal ?? 0)}</span>
          </div>
          <button
            onClick={goCheckout}
            disabled={!cart || cart.items.length === 0}
            className="w-full rounded bg-accent text-white py-3 font-medium disabled:opacity-50 hover:opacity-90"
          >
            Ödemeye Geç
          </button>
        </footer>
      </aside>
    </>
  );
}
