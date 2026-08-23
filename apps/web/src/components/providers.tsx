'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCart } from '@/lib/cart-store';
import { useAuth } from '@/lib/auth-store';
import { CartDrawer } from '@/components/cart/CartDrawer';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const fetchCart = useCart((s) => s.fetch);
  const mergeCart = useCart((s) => s.merge);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Merge guest → user cart whenever a user appears (login).
  useEffect(() => {
    if (user) mergeCart();
  }, [user, mergeCart]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <CartDrawer />
    </QueryClientProvider>
  );
}
