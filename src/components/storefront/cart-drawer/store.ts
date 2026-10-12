"use client";

import { useSyncExternalStore } from "react";
import type { MiniCart } from "@/modules/cart/mini-cart";

/** Tiny shared store so any button (product page, header) can open the one cart drawer. */
export interface CartDrawerState {
  open: boolean;
  cart: MiniCart | null;
  /** e.g. "Added to your cart." */
  notice: string | null;
  loading: boolean;
}

let state: CartDrawerState = { open: false, cart: null, notice: null, loading: false };
const listeners = new Set<() => void>();

function set(next: Partial<CartDrawerState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const cartDrawer = {
  show(cart: MiniCart | null, notice: string | null = null) {
    set({ open: true, cart: cart ?? state.cart, notice, loading: cart === null });
  },
  update(cart: MiniCart) {
    set({ cart, loading: false });
  },
  close() {
    set({ open: false, notice: null });
  },
};

const serverState: CartDrawerState = { open: false, cart: null, notice: null, loading: false };

export function useCartDrawer(): CartDrawerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => serverState,
  );
}
