'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';

const TABS = [
  { href: '/admin', label: 'Özet' },
  { href: '/admin/analytics', label: 'Analitik' },
  { href: '/admin/products', label: 'Ürünler' },
  { href: '/admin/orders', label: 'Siparişler' },
  { href: '/admin/flash-sales', label: 'Flash Fırsatlar' },
  { href: '/admin/sync', label: 'Veri Senkronu' },
  { href: '/admin/conflicts', label: 'Çakışmalar' },
  { href: '/admin/units', label: 'Birimler' },
  { href: '/admin/games', label: 'Oyunlar' },
  { href: '/admin/customers', label: 'Müşteriler' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (user === null) router.replace('/login');
    else if (user && !user.isAdmin) router.replace('/');
  }, [user, router]);

  if (!user || !user.isAdmin) {
    return <div className="py-12 text-center text-sm">Yönetici yetkisi gerekiyor…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <nav
        className="flex gap-1 border-b overflow-x-auto"
        style={{ borderColor: 'var(--aksioma-border)' }}
      >
        {TABS.map((t) => {
          const active = path === t.href || (t.href !== '/admin' && path.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 py-2 text-sm border-b-2 -mb-[1px] whitespace-nowrap ${
                active ? 'border-accent text-accent font-medium' : 'border-transparent'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
