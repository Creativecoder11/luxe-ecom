/**
 * Synthetic delivery zones, opening stock and a coupon for development/E2E (never production).
 * Real fees, VAT and COD rules are configured by the owner in Settings (D-028–D-030).
 */
import { db } from "../../src/lib/db/client";
import type { StaffActor } from "../../src/modules/identity/actor";
import { saveCoupon } from "../../src/modules/checkout/coupon.service";
import { adjustStock } from "../../src/modules/inventory/inventory.service";
import { saveShippingZone } from "../../src/modules/settings/commerce.service";

export async function seedCommerceSamples(actor: StaffActor) {
  await saveShippingZone(actor, null, {
    name: "Inside Dhaka (sample)",
    districts: ["dhaka"],
    baseFee: "60",
    includedWeightGrams: 1000,
    extraPerKg: "20",
    estimate: "1–2 days",
  });
  await saveShippingZone(actor, null, {
    name: "Rest of Bangladesh (sample)",
    isFallback: true,
    baseFee: "120",
    includedWeightGrams: 1000,
    extraPerKg: "25",
    freeShippingThreshold: "5000",
    estimate: "2–4 days",
  });

  const variants = await db.productVariant.findMany({ where: { businessId: actor.businessId }, select: { id: true, sku: true } });
  for (const [i, v] of variants.entries()) {
    // Varied quantities so low-stock and out-of-stock states appear; KRT-CLASSIC-L-OLIVE stays at 0.
    const quantity = v.sku === "KRT-CLASSIC-L-OLIVE" ? 0 : [25, 12, 4, 40, 8][i % 5]!;
    if (quantity > 0) await adjustStock(actor, { variantId: v.id, quantity, reason: "OPENING_BALANCE", note: "Sample opening stock" });
  }

  await saveCoupon(actor, null, { code: "WELCOME10", description: "Sample: 10% off first orders", type: "PERCENT", percent: "10", maxDiscount: "500", perCustomerLimit: "1" });
}
