import "server-only";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";

export async function isWishlisted(userId: string, productId: string): Promise<boolean> {
  return !!(await db.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } }));
}

/** Adds or removes a published product from the customer's wishlist; returns the new state. */
export async function toggleWishlist(businessId: string, userId: string, productId: string): Promise<boolean> {
  const product = await db.product.findFirst({ where: { id: productId, businessId, status: "ACTIVE" }, select: { id: true } });
  if (!product) throw new NotFoundError("Product");
  const existing = await isWishlisted(userId, productId);
  if (existing) await db.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
  else await db.wishlistItem.create({ data: { userId, productId } });
  return !existing;
}

export async function removeFromWishlist(userId: string, productId: string) {
  await db.wishlistItem.deleteMany({ where: { userId, productId } });
}

/** Wishlist for the signed-in customer; unpublished products are shown as unavailable, not hidden. */
export async function listWishlist(userId: string) {
  const items = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          priceFromMinor: true,
          compareAtFromMinor: true,
          brand: { select: { name: true } },
          media: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true, alt: true } },
        },
      },
    },
  });
  return items.map((i) => ({ ...i.product, available: i.product.status === "ACTIVE" && i.product.priceFromMinor !== null }));
}
