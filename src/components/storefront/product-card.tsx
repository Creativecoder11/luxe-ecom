import { ImageOff } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { mediaUrl } from "@/lib/media";
import type { ListingItem } from "@/modules/catalog/storefront";
import { cn } from "@/lib/utils/cn";

export interface ProductCardData {
  href: string;
  title: string;
  brand?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  priceMinor: number;
  compareAtMinor?: number | null;
  currency: string;
  /** e.g. "Out of stock", "New". Never a fabricated urgency claim. */
  badge?: string | null;
  /** Shows "From" when variants are priced differently. */
  priceVaries?: boolean;
  /** Colour options available on the product. */
  swatches?: { label: string; hex: string }[];
}

export function toCardData(item: ListingItem, currency = "BDT"): ProductCardData {
  return {
    href: `/products/${item.slug}`,
    title: item.title,
    brand: item.brand,
    imageUrl: item.imageKey ? mediaUrl(item.imageKey) : null,
    imageAlt: item.imageAlt,
    priceMinor: item.priceFromMinor,
    compareAtMinor: item.compareAtFromMinor,
    priceVaries: item.priceVaries,
    swatches: item.swatches,
    currency,
  };
}

export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#e9e8e6]", className)}>
      {src ? (
        // Served by our own /media route with fixed headers; next/image optimisation needs sharp (not installed).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center text-[#b9b6b1]">
          <ImageOff className="size-7" aria-hidden="true" />
          <span className="sr-only">No image</span>
        </div>
      )}
    </div>
  );
}

export function Swatches({ swatches, className }: { swatches?: { label: string; hex: string }[]; className?: string }) {
  if (!swatches?.length) return null;
  return (
    <ul className={cn("flex items-center gap-2", className)} aria-label={`Colours: ${swatches.map((s) => s.label).join(", ")}`}>
      {swatches.map((s) => (
        <li key={s.label} title={s.label} className="size-3.5 rounded-full ring-1 ring-black/15 ring-offset-2 ring-offset-transparent" style={{ backgroundColor: s.hex }} />
      ))}
    </ul>
  );
}

export function Price({ product, className }: { product: Pick<ProductCardData, "priceMinor" | "compareAtMinor" | "currency" | "priceVaries">; className?: string }) {
  const onSale = product.compareAtMinor != null && product.compareAtMinor > product.priceMinor;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] font-bold text-[#111]", className)}>
      <span>
        {product.priceVaries ? "From " : null}
        {formatMoney(product.priceMinor, product.currency)}
      </span>
      {onSale ? (
        <span className="text-sm font-normal text-[#8a8780] line-through">
          <span className="sr-only">Was </span>
          {formatMoney(product.compareAtMinor!, product.currency)}
        </span>
      ) : null}
    </p>
  );
}

/** Product tile used by listings, homepage rails and the wishlist. */
export function ProductCard({ product }: { product: ProductCardData }) {
  const onSale = product.compareAtMinor != null && product.compareAtMinor > product.priceMinor;
  return (
    <article className="group relative flex flex-col">
      <div className="relative">
        <ProductImage src={product.imageUrl} alt={product.imageAlt ?? product.title} className="aspect-square rounded-2xl" />
        {product.badge || onSale ? (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {onSale ? <Badge tone="danger">Sale</Badge> : null}
            {product.badge ? <Badge className="bg-white/90">{product.badge}</Badge> : null}
          </div>
        ) : null}
      </div>
      <div className="mt-3.5 space-y-1">
        {product.brand ? <p className="text-[0.8125rem] text-[#77746e]">{product.brand}</p> : null}
        <h3 className="line-clamp-2 text-[0.9375rem] leading-snug text-[#111]">
          <Link href={product.href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-ring">
            {product.title}
          </Link>
        </h3>
        <Price product={product} />
        <Swatches swatches={product.swatches} className="pt-1.5" />
      </div>
    </article>
  );
}
