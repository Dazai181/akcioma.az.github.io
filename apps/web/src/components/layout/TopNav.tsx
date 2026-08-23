'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-store';
import { CartIcon } from '@/components/cart/CartIcon';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function TopNav() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clearSession);

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--aksioma-bg) 80%, transparent)',
        borderColor: 'var(--aksioma-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="font-bold text-lg" style={{ color: 'var(--aksioma-primary)' }}>
          Aksioma
        </Link>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/category/yazi-gerecleri" className="hover:underline">Yazı Gereçleri</Link>
          <Link href="/category/defter-bloknot" className="hover:underline">Defter</Link>
          <Link href="/category/ofis-aksesuarlari" className="hover:underline">Ofis</Link>
          <Link href="/games" className="hover:underline text-accent font-medium">🎁 Hediyeler</Link>
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-2 text-sm">
            {user.isAdmin && (
              <Link href="/admin" className="rounded px-3 py-1 border text-accent" style={{ borderColor: 'var(--aksioma-accent)' }}>
                Admin
              </Link>
            )}
            <Link href="/orders" className="hidden sm:inline rounded px-3 py-1 border" style={{ borderColor: 'var(--aksioma-border)' }}>
              Siparişlerim
            </Link>
            <span className="hidden sm:inline">Merhaba, {user.firstName}</span>
            <button onClick={clear} className="rounded px-3 py-1 border" style={{ borderColor: 'var(--aksioma-border)' }}>
              Çıkış
            </button>
          </div>
        ) : (
          <Link href="/login" className="rounded px-3 py-1 border text-sm" style={{ borderColor: 'var(--aksioma-border)' }}>
            Giriş
          </Link>
        )}
        <CartIcon />
      </div>
    </header>
  );
}
