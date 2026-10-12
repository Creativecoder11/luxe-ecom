"use client";

import { CheckCircle2, CircleAlert, ImageOff, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { removeMiniCartLineAction } from "@/app/(storefront)/cart/actions";
import { Spinner } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { MiniCart, MiniCartLine } from "@/modules/cart/mini-cart";
import { cartDrawer, useCartDrawer } from "./store";

const money = (minor: number) => formatMoney(minor, "BDT");

function Line({ line }: { line: MiniCartLine }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className={cn("relative flex gap-4 py-5 pr-8", pending && "opacity-50")}>
      <Link href={line.href} onClick={() => cartDrawer.close()} className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-md bg-[#f1f0ee]" tabIndex={-1} aria-hidden="true">
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-[#b9b6b1]">
            <ImageOff className="size-5" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={line.href} onClick={() => cartDrawer.close()} className="line-clamp-2 text-[0.9375rem] text-[#111] hover:underline">
          {line.title}
        </Link>
        {line.variantTitle ? <p className="mt-0.5 text-xs text-[#77746e]">{line.variantTitle}</p> : null}
        <p className="mt-2 text-sm">
          <span className="text-[#9a978f]">{line.quantity} ×</span> <span className="font-semibold text-[#111]">{money(line.unitPriceMinor)}</span>
        </p>
        {line.problem ? (
          <p className="mt-1 text-xs text-danger">{line.problem === "unavailable" ? "No longer available" : "Not enough stock: reduce the quantity in the cart"}</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${line.title}`}
        onClick={() =>
          startTransition(async () => {
            const result = await removeMiniCartLineAction(line.variantId);
            if (result.ok && result.data) cartDrawer.update(result.data);
          })
        }
        className="absolute top-5 right-0 inline-flex size-7 items-center justify-center rounded-full text-[#555] hover:bg-[#f1f0ee] hover:text-[#111]"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

/** While an optimistic add is still saving, cart/checkout links wait (a few hundred ms) so they open the saved cart. */
function Summary({ cart, syncing }: { cart: MiniCart; syncing: boolean }) {
  const free = cart.freeDelivery;
  return (
    <div className="border-t border-[#e8e6e2]">
      <div className="flex items-center justify-between px-6 py-5 font-display text-2xl font-semibold">
        <span>Subtotal:</span>
        <span>{money(cart.subtotalMinor)}</span>
      </div>
      {cart.discountMinor > 0 ? <p className="-mt-3 px-6 pb-3 text-sm text-[#157f3c]">Coupon discount: −{money(cart.discountMinor)}</p> : null}
      <div className="space-y-4 border-t border-[#e8e6e2] px-6 py-5">
        {free ? (
          <div>
            <p className="text-[0.9375rem]">
              {free.remainingMinor > 0 ? (
                <>
                  Only <strong>{money(free.remainingMinor)}</strong> away from free delivery
                </>
              ) : (
                <strong>You qualify for free delivery</strong>
              )}
              <span className="text-[#77746e]"> ({free.zoneNames.join(", ")})</span>
            </p>
            <div className="mt-3 h-2.5 overflow-hidden bg-[#efefef]" role="progressbar" aria-label="Progress to free delivery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={free.percent}>
              <div className="h-full bg-[repeating-linear-gradient(135deg,#111_0_6px,#555_6px_12px)] transition-[width] duration-500" style={{ width: `${Math.max(free.percent, 2)}%` }} />
            </div>
          </div>
        ) : null}
        <Link href="/cart" onClick={() => cartDrawer.close()} aria-disabled={syncing} className="flex h-14 aria-disabled:pointer-events-none aria-disabled:opacity-60 items-center justify-center bg-[#f5f5f5] text-[0.9375rem] font-medium hover:bg-[#ebebeb]">
          View cart
        </Link>
        <Link href="/checkout" onClick={() => cartDrawer.close()} aria-disabled={syncing} className="flex h-14 aria-disabled:pointer-events-none aria-disabled:opacity-60 items-center justify-center bg-[#111] text-[0.9375rem] font-medium text-white hover:bg-[#2a2a2a]">
          Checkout
        </Link>
      </div>
    </div>
  );
}

/** Slide-in cart opened after "Add to cart" (and from the header cart icon). One instance per page. */
export function CartDrawer() {
  const { open, cart, notice, error, loading, syncing } = useCartDrawer();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-drawer-title"
      onClose={() => cartDrawer.close()}
      onClick={(event) => {
        if (event.target === dialogRef.current) cartDrawer.close();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[26.5rem] bg-white p-0 text-[#111] shadow-2xl backdrop:bg-black/55 open:animate-[drawer-in_220ms_ease-out] motion-reduce:open:animate-none"
    >
      {/* Content only while open: a closed drawer adds nothing to the page or the accessibility tree. */}
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#e8e6e2] px-6 py-6">
            <h2 id="cart-drawer-title" className="font-display text-2xl font-medium tracking-[-0.02em]">
              Shopping cart
            </h2>
            <button type="button" onClick={() => cartDrawer.close()} className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium hover:opacity-70">
              <X className="size-5" aria-hidden="true" /> Close
            </button>
          </div>

          {error ? (
            <p role="alert" className="flex items-center gap-2 border-b border-[#e8e6e2] bg-danger-soft px-6 py-2.5 text-sm text-danger">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          ) : syncing ? (
            <p role="status" className="flex items-center gap-2 border-b border-[#e8e6e2] bg-[#f7f7f5] px-6 py-2.5 text-sm text-[#55524c]">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> Adding to your cart…
            </p>
          ) : notice ? (
            <p role="status" className="flex items-center gap-2 border-b border-[#e8e6e2] bg-[#f3faf5] px-6 py-2.5 text-sm text-[#157f3c]">
              <CheckCircle2 className="size-4" aria-hidden="true" /> {notice}
            </p>
          ) : null}

          <div className="flex-1 overflow-y-auto px-6">
            {loading && !cart ? (
              <div className="flex justify-center py-16">
                <Spinner label="Loading cart" />
              </div>
            ) : cart && cart.lines.length ? (
              <ul className="divide-y divide-[#efede9]" aria-label="Cart items">
                {cart.lines.map((line) => (
                  <Line key={line.variantId} line={line} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-[#77746e]">
                <ShoppingBag className="size-10" strokeWidth={1.4} aria-hidden="true" />
                <p>Your cart is empty.</p>
                <Link href="/shop" onClick={() => cartDrawer.close()} className="text-sm font-medium text-[#111] underline underline-offset-4">
                  Continue shopping
                </Link>
              </div>
            )}
          </div>

          {cart && cart.lines.length ? <Summary cart={cart} syncing={syncing} /> : null}
        </div>
      ) : null}
    </dialog>
  );
}
