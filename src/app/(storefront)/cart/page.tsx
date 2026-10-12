import { ImageOff, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { mediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { loadCartView } from "@/modules/cart/cart.service";
import { CouponForm, QuantityControl } from "./cart-controls";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

async function Cart() {
  const view = await loadCartView(await getBusinessId(), await readCartToken());
  if (view.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title="Your cart is empty"
        description="Browse the store and add something you like."
        action={<Link href="/shop" className={buttonVariants({ variant: "outline" })}>Continue shopping</Link>}
      />
    );
  }
  const { pricing } = view;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-label="Cart items">
        {view.hasProblems ? (
          <Alert tone="warning" className="mb-4">Some items changed since you added them. Update or remove them to check out.</Alert>
        ) : null}
        <ul className="divide-y divide-border border-y border-border">
          {view.lines.map((line) => {
            const label = line.variantTitle ? `${line.productTitle} (${line.variantTitle})` : line.productTitle;
            return (
              <li key={line.variantId} className="flex gap-4 py-5">
                <Link href={`/products/${line.slug}`} className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-subtle-foreground">
                  {line.imageKey ? (
                    <Image src={mediaUrl(line.imageKey)} alt="" fill sizes="96px" className="object-cover" />
                  ) : (
                    <ImageOff className="size-6" aria-hidden="true" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/products/${line.slug}`} className="font-medium hover:underline">{line.productTitle}</Link>
                    {line.variantTitle ? <p className="text-sm text-muted-foreground">{line.variantTitle}</p> : null}
                    <p className="mt-1 text-sm">{formatMoney(line.unitPriceMinor)} each</p>
                    {line.problem === "unavailable" ? <p className="mt-1 text-sm font-medium text-danger">No longer available. Please remove it.</p> : null}
                    {line.problem === "insufficient_stock" ? (
                      <p className="mt-1 text-sm font-medium text-danger">
                        {line.available ? `Only ${line.available} left. Reduce the quantity.` : "Out of stock. Please remove it."}
                      </p>
                    ) : null}
                    {line.problem === null && line.available !== null && line.available <= 5 ? (
                      <p className="mt-1 text-xs text-warning">Only {line.available} left</p>
                    ) : null}
                  </div>
                  <div className="flex items-start gap-4 sm:flex-col sm:items-end">
                    <QuantityControl variantId={line.variantId} quantity={line.quantity} max={line.available ?? 99} label={label} />
                    <p className="font-semibold tabular-nums">{formatMoney(line.lineTotalMinor)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside aria-label="Order summary">
        <Card className="space-y-4 p-5 lg:sticky lg:top-28">
          <h2 className="text-lg font-semibold">Summary</h2>
          <CouponForm applied={view.couponCode} error={view.couponError} />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(pricing.subtotalMinor)}</dd></div>
            {pricing.discountMinor > 0 ? (
              <div className="flex justify-between text-success"><dt>Discount</dt><dd className="tabular-nums">−{formatMoney(pricing.discountMinor)}</dd></div>
            ) : null}
            {pricing.taxMinor > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <dt>{view.pricesIncludeTax ? "VAT included" : "VAT"}</dt>
                <dd className="tabular-nums">{formatMoney(pricing.taxMinor)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Total so far</dt>
              <dd className="tabular-nums">{formatMoney(pricing.totalMinor)}</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            aria-disabled={view.hasProblems}
            className={cn(buttonVariants({ size: "lg" }), "w-full rounded-full", view.hasProblems && "pointer-events-none opacity-50")}
          >
            Checkout
          </Link>
          {view.codEnabled ? <p className="text-center text-xs text-muted-foreground">Pay with Cash on Delivery</p> : null}
        </Card>
      </aside>
    </div>
  );
}

export default function CartPage() {
  return (
    <>
      <StorefrontPageHeader title="Your cart" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <Cart />
        </Suspense>
      </div>
    </>
  );
}
