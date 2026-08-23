'use client';

import { create } from 'zustand';
import { api } from './api';
import { track } from './track';
import type { Cart } from './types';

interface CartState {
  cart: Cart | null;
  drawerOpen: boolean;
  loading: boolean;
  fetch: () => Promise<void>;
  add: (productId: string, quantity?: number) => Promise<void>;
  update: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  merge: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useCart = create<CartState>((set, get) => ({
  cart: null,
  drawerOpen: false,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<Cart>('/cart');
      set({ cart: data });
    } finally {
      set({ loading: false });
    }
  },

  add: async (productId, quantity = 1) => {
    const { data } = await api.post<Cart>('/cart/items', { productId, quantity });
    set({ cart: data, drawerOpen: true });
    track('ADD_TO_CART', { productId, payload: { quantity } });
  },

  update: async (itemId, quantity) => {
    const { data } = await api.patch<Cart>(`/cart/items/${itemId}`, { quantity });
    set({ cart: data });
  },

  remove: async (itemId) => {
    const removed = get().cart?.items.find((i) => i.id === itemId);
    const { data } = await api.delete<Cart>(`/cart/items/${itemId}`);
    set({ cart: data });
    if (removed) {
      track('REMOVE_FROM_CART', { productId: removed.productId });
    }
  },

  merge: async () => {
    try {
      const { data } = await api.post<Cart>('/cart/merge');
      set({ cart: data });
    } catch {
      // ignore — already merged or no guest cart
      await get().fetch();
    }
  },

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
