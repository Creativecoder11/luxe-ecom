"use client";

import { useSyncExternalStore } from "react";
import { getMiniCartAction } from "@/app/(storefront)/cart/actions";
import type { ActionResult } from "@/lib/action-result";
import type { MiniCart, MiniCartLine } from "@/modules/cart/mini-cart";

/** Tiny shared store so any button (product page, header) can open the one cart drawer. */
export interface CartDrawerState {
  open: boolean;
  cart: MiniCart | null;
  /** e.g. "Added to your cart." */
  notice: string | null;
  /** Shown instead of the notice when an add failed and was rolled back. */
  error: string | null;
  loading: boolean;
  /** True while an optimistic add is being saved ("Adding to your cart…"); the notice follows once saved. */
  syncing: boolean;
  /** Item count from the last cart the server returned; null = use the header's server-rendered count. */
  confirmedCount: number | null;
  /** Units added optimistically and not yet confirmed. */
  pendingQuantity: number;
}

let state: CartDrawerState = { open: false, cart: null, notice: null, error: null, loading: false, syncing: false, confirmedCount: null, pendingQuantity: 0 };
const listeners = new Set<() => void>();
let latestAdd = 0;
let prefetching: Promise<void> | null = null;

function set(next: Partial<CartDrawerState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** The cart with `line` merged in, totals recomputed locally (the server's cart replaces it shortly). */
function withLine(cart: MiniCart | null, line: MiniCartLine): MiniCart {
  const lines = cart?.lines ?? [];
  const existing = lines.find((l) => l.variantId === line.variantId);
  const merged = existing
    ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + line.quantity, lineTotalMinor: l.lineTotalMinor + line.lineTotalMinor } : l))
    : [line, ...lines];
  return {
    lines: merged,
    itemCount: (cart?.itemCount ?? 0) + line.quantity,
    subtotalMinor: (cart?.subtotalMinor ?? 0) + line.lineTotalMinor,
    discountMinor: cart?.discountMinor ?? 0,
    freeDelivery: cart?.freeDelivery ?? null,
  };
}

export const cartDrawer = {
  show(cart: MiniCart | null, notice: string | null = null) {
    set({ open: true, cart: cart ?? state.cart, notice, error: null, loading: cart === null && state.cart === null });
  },
  update(cart: MiniCart) {
    set({ cart, loading: false, confirmedCount: cart.itemCount });
  },
  close() {
    set({ open: false, notice: null, error: null });
  },
  /** Loads the current cart in the background (e.g. on hover of "Add to cart") so the drawer opens complete. */
  prefetch() {
    if (state.cart || prefetching) return;
    prefetching = getMiniCartAction()
      .then((cart) => {
        if (!state.syncing) set({ cart, confirmedCount: cart.itemCount });
      })
      .catch(() => {})
      .finally(() => {
        prefetching = null;
      });
  },
  /**
   * Opens the drawer with `line` already added, then runs the server action. The server's cart
   * replaces the optimistic one; on failure the previous cart comes back with the error.
   */
  async add(line: MiniCartLine, run: () => Promise<ActionResult<MiniCart>>): Promise<ActionResult<MiniCart>> {
    const id = ++latestAdd;
    const previous = state.cart;
    set({
      open: true,
      cart: withLine(state.cart, line),
      notice: null,
      error: null,
      loading: false,
      syncing: true,
      pendingQuantity: state.pendingQuantity + line.quantity,
    });
    let result: ActionResult<MiniCart>;
    try {
      result = await run();
    } catch {
      result = { ok: false, error: "Could not reach the store. Check your connection and try again." };
    }
    const pendingQuantity = Math.max(0, state.pendingQuantity - line.quantity);
    const latest = id === latestAdd;
    if (result.ok && result.data) {
      // An older response must not overwrite the optimistic state of a newer add.
      // The server count already includes this add; newer adds are still counted in pendingQuantity.
      set(
        latest
          ? { cart: result.data, syncing: false, pendingQuantity, confirmedCount: result.data.itemCount, notice: result.message ?? "Added to your cart." }
          : { pendingQuantity, confirmedCount: result.data.itemCount },
      );
    } else {
      set({ cart: latest ? previous : state.cart, syncing: false, pendingQuantity, notice: null, error: result.ok ? null : result.error });
    }
    return result;
  },
  /** The header's server-rendered count changed (e.g. after the cart page refreshed): trust it again. */
  resetCount() {
    if (state.confirmedCount !== null && state.pendingQuantity === 0) set({ confirmedCount: null });
  },
};

const serverState: CartDrawerState = { open: false, cart: null, notice: null, error: null, loading: false, syncing: false, confirmedCount: null, pendingQuantity: 0 };

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
