"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { getMiniCartAction } from "@/app/(storefront)/cart/actions";
import { cartDrawer } from "./store";

/** Header cart link: opens the drawer on a normal click; a plain link to /cart without JavaScript or with modifier keys. */
export function CartTrigger({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Link
      href="/cart"
      aria-label="Cart"
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        cartDrawer.show(null);
        void getMiniCartAction().then((cart) => cartDrawer.update(cart));
      }}
    >
      {children}
    </Link>
  );
}
