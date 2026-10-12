"use client";

import { Heart } from "lucide-react";
import { useActionState, useMemo, useState, type FormEvent } from "react";
import { addToCartAction } from "@/app/(storefront)/cart/actions";
import { toggleWishlistAction } from "@/app/(storefront)/products/[slug]/actions";
import { Button } from "@/components/ui/button";
import { cartDrawer } from "./cart-drawer/store";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { StorefrontProduct } from "@/modules/catalog/storefront";

type Props = Pick<StorefrontProduct, "axes" | "variants" | "currency"> & {
  productId: string;
  slug: string;
  /** Used to show the cart line instantly, before the server confirms. */
  title: string;
  imageUrl: string | null;
  /** Sellable units per variant id; null = not tracked (always available). */
  stock: Record<string, number | null>;
  wishlisted: boolean;
};

const LOW_STOCK = 5;

function findVariant(variants: Props["variants"], selection: Record<string, string>) {
  return variants.find((v) => Object.entries(selection).every(([code, value]) => v.options[code] === value));
}

/** Option buttons per axis; combinations that do not exist as an active variant are disabled. */
export function VariantPicker({ axes, variants, currency, productId, slug, title, imageUrl, stock, wishlisted }: Props) {
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    // Start on the first variant that can be bought.
    const firstInStock = variants.find((v) => stock[v.id] === null || (stock[v.id] ?? 0) > 0) ?? variants[0];
    return { ...(firstInStock?.options ?? {}) };
  });
  const variant = useMemo(() => findVariant(variants, selection), [variants, selection]);
  // Form action only runs without JavaScript; with JavaScript the add is optimistic (onAdd).
  const [, cartAction] = useActionState(addToCartAction, null);
  const [cartError, setCartError] = useState<string | null>(null);
  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variant) return;
    const form = new FormData(event.currentTarget);
    const quantity = Math.max(1, Number(form.get("quantity")) || 1);
    setCartError(null);
    // The drawer opens with the line at once; the server's cart replaces it when the action returns.
    void cartDrawer
      .add(
        {
          variantId: variant.id,
          href: `/products/${slug}`,
          title,
          variantTitle: axes.length ? variant.title : null,
          imageUrl,
          quantity,
          unitPriceMinor: variant.priceMinor,
          lineTotalMinor: variant.priceMinor * quantity,
          problem: null,
        },
        () => addToCartAction(null, form),
      )
      .then((result) => setCartError(result.ok ? null : result.error));
  }
  const units = variant ? stock[variant.id] : 0;
  const soldOut = units !== null && (units ?? 0) <= 0;
  const maxQuantity = units === null || units === undefined ? 10 : Math.min(10, units);
  const onSale = variant?.compareAtMinor != null && variant.compareAtMinor > variant.priceMinor;

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        {variant ? (
          <p className="flex items-baseline gap-3">
            <span className="text-2xl font-bold">{formatMoney(variant.priceMinor, currency)}</span>
            {onSale ? (
              <>
                <span className="text-muted-foreground line-through">
                  <span className="sr-only">Was </span>
                  {formatMoney(variant.compareAtMinor!, currency)}
                </span>
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                  Save {formatMoney(variant.compareAtMinor! - variant.priceMinor, currency, { showDecimals: false })}
                </span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-danger">This combination is not available.</p>
        )}
        {variant ? <p className="mt-1 text-xs text-subtle-foreground">SKU {variant.sku}</p> : null}
        {variant ? (
          <p className={cn("mt-2 text-sm font-medium", soldOut ? "text-danger" : units !== null && (units ?? 0) <= LOW_STOCK ? "text-warning" : "text-success")}>
            {soldOut ? "Out of stock" : units !== null && (units ?? 0) <= LOW_STOCK ? `Only ${units} left` : "In stock"}
          </p>
        ) : null}
      </div>

      {axes.map((axis) => (
        <fieldset key={axis.code}>
          <legend className="mb-2 text-sm font-medium">
            {axis.label}: <span className="text-muted-foreground">{axis.options.find((o) => o.value === selection[axis.code])?.label}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {axis.options.map((option) => {
              const next = { ...selection, [axis.code]: option.value };
              const exists = Boolean(findVariant(variants, next));
              const active = selection[axis.code] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  disabled={!exists}
                  onClick={() => setSelection(next)}
                  className={cn(
                    "inline-flex h-10 min-w-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through",
                    active ? "border-foreground bg-foreground text-background" : "border-border-strong hover:border-foreground",
                  )}
                >
                  {option.colorHex ? (
                    <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: option.colorHex }} aria-hidden="true" />
                  ) : null}
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="space-y-3">
        <div className="flex gap-2">
          <form action={cartAction} onSubmit={onAdd} className="flex flex-1 gap-2">
            <input type="hidden" name="variantId" value={variant?.id ?? ""} />
            <label htmlFor="quantity" className="sr-only">Quantity</label>
            <select
              id="quantity"
              name="quantity"
              defaultValue="1"
              disabled={!variant || soldOut}
              className="h-12 rounded-full border border-border-strong bg-surface px-4 text-sm"
            >
              {Array.from({ length: Math.max(1, maxQuantity) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Button
              type="submit"
              size="lg"
              className="flex-1 rounded-full"
              disabled={!variant || soldOut}
              onPointerEnter={() => cartDrawer.prefetch()}
              onFocus={() => cartDrawer.prefetch()}
            >
              {soldOut ? "Out of stock" : "Add to cart"}
            </Button>
          </form>
          <form action={toggleWishlistAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              aria-pressed={wishlisted}
              aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
              className="inline-flex size-12 items-center justify-center rounded-full border border-border-strong hover:border-foreground"
            >
              <Heart className={cn("size-5", wishlisted && "fill-danger text-danger")} />
            </button>
          </form>
        </div>
        <div aria-live="polite" className="min-h-5 text-sm">
          {cartError ? <p className="text-danger">{cartError}</p> : null}
        </div>
      </div>
    </div>
  );
}
