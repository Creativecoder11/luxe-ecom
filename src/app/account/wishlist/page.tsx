import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/storefront/product-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/display";
import { mediaUrl } from "@/lib/media";
import { listWishlist } from "@/modules/cart/wishlist.service";
import { requireCustomer } from "@/modules/identity/session";
import { removeWishlistItemAction } from "../actions";

export const metadata: Metadata = { title: "Wishlist" };

async function Wishlist() {
  const user = await requireCustomer("/account/wishlist");
  const items = await listWishlist(user.id);
  if (items.length === 0) {
    return <EmptyState icon={<Heart />} title="Your wishlist is empty" description="Tap the heart on a product to save it here." action={<Link href="/shop" className={buttonVariants({ variant: "outline" })}>Browse products</Link>} />;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Wishlist</h2>
      <ul className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {items.map((p) => (
          <li key={p.id} className="space-y-2">
            <ProductCard
              product={{
                href: `/products/${p.slug}`,
                title: p.title,
                brand: p.brand?.name,
                imageUrl: p.media[0] ? mediaUrl(p.media[0].storageKey) : null,
                imageAlt: p.media[0]?.alt,
                priceMinor: p.priceFromMinor ?? 0,
                compareAtMinor: p.compareAtFromMinor,
                currency: "BDT",
                badge: p.available ? null : "Unavailable",
              }}
            />
            <form action={removeWishlistItemAction}>
              <input type="hidden" name="productId" value={p.id} />
              <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:underline">Remove</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <Wishlist />
    </Suspense>
  );
}
