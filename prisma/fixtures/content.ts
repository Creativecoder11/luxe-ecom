/**
 * Synthetic homepage content for development/E2E (never production). Real banners, copy and
 * images are entered by the owner in Admin → Homepage settings. Sample banner photos are
 * attached separately by ./homepage-images.ts.
 */
import { db } from "../../src/lib/db/client";
import { saveCoupon } from "../../src/modules/checkout/coupon.service";
import { updateHomepageSection } from "../../src/modules/content/content.service";
import type { StaffActor } from "../../src/modules/identity/actor";

export async function seedHomepageSamples(actor: StaffActor) {
  if (await db.storefrontContent.findUnique({ where: { businessId: actor.businessId } })) return false;

  const endsAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  if (!(await db.coupon.findFirst({ where: { businessId: actor.businessId, code: "SEASON15" } }))) {
    await saveCoupon(actor, null, { code: "SEASON15", description: "Sample: seasonal 15% off", type: "PERCENT", percent: "15", maxDiscount: "1000", endsAt });
  }

  const fields: Record<string, string> = {
    announcement: "Sample notice: free delivery outside Dhaka on orders over ৳5,000",
    "featured.lead": "Everyday Essentials for",
    "featured.accent": "Modern Living",
    statement: "Discover beauty, fashion, gadgets and home essentials chosen for quality, comfort and everyday value.",
    showStats: "on",
    "sale.couponCode": "SEASON15",
    "sale.eyebrow": "Seasonal offer (sample)",
    "sale.title": "Save 15% on your next order",
    "sale.body": "Enjoy 15% off (up to ৳1,000) across the store.",
    "sale.tags": "Beauty, Fashion, Gadgets",
    "sale.ctaLabel": "Shop now",
    "sale.href": "/shop",
    marquee: "Everyday Essentials\nStyle That Lasts\nSmart Tech, Better Living",
  };
  const get = (name: string) => fields[name] ?? "";
  for (const section of ["general", "featured", "statement", "sale", "footer"] as const) {
    await updateHomepageSection(actor, section, get);
  }
  return true;
}
