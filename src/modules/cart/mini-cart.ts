import "server-only";
import { db } from "@/lib/db/client";
import { mediaUrl } from "@/lib/media";
import { getCartView } from "./cart.service";
import { freeDeliveryProgress, type FreeDeliveryProgress } from "./free-delivery";

export interface MiniCartLine {
  variantId: string;
  href: string;
  title: string;
  variantTitle: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  problem: "unavailable" | "insufficient_stock" | null;
}

export interface MiniCart {
  lines: MiniCartLine[];
  itemCount: number;
  subtotalMinor: number;
  discountMinor: number;
  freeDelivery: FreeDeliveryProgress | null;
}

/** Client-safe summary of the shopper's cart for the slide-in drawer (prices recomputed from the catalog). */
export async function getMiniCart(businessId: string, token: string | null): Promise<MiniCart> {
  const [view, zones] = await Promise.all([
    getCartView(db, businessId, token),
    db.shippingZone.findMany({ where: { businessId, isActive: true }, select: { name: true, freeShippingThresholdMinor: true } }),
  ]);
  return {
    lines: view.lines.map((l) => ({
      variantId: l.variantId,
      href: `/products/${l.slug}`,
      title: l.productTitle,
      variantTitle: l.variantTitle,
      imageUrl: l.imageKey ? mediaUrl(l.imageKey) : null,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      lineTotalMinor: l.lineTotalMinor,
      problem: l.problem,
    })),
    itemCount: view.itemCount,
    subtotalMinor: view.pricing.subtotalMinor,
    discountMinor: view.pricing.discountMinor,
    freeDelivery: view.lines.length ? freeDeliveryProgress(zones, view.pricing.subtotalMinor - view.pricing.discountMinor) : null,
  };
}
