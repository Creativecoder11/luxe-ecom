"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { cartDrawer, useCartDrawer } from "./store";

/**
 * Header cart count. Starts from the server-rendered count and follows the drawer store, so an
 * optimistic "Add to cart" bumps the badge immediately (before the server answers).
 */
export function LiveCount({ serverCount, tone }: { serverCount: number; tone: "light" | "dark" }) {
  const { confirmedCount, pendingQuantity } = useCartDrawer();
  // A fresh server count (after a page refresh) wins over the store's last confirmed count.
  useEffect(() => cartDrawer.resetCount(), [serverCount]);
  const count = (confirmedCount ?? serverCount) + pendingQuantity;
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[0.6875rem] font-semibold",
        tone === "dark" ? "bg-white text-[#111]" : "bg-primary text-primary-foreground",
      )}
      aria-label={`${count} items in cart`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
