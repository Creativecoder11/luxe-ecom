/**
 * Seeds the synthetic multi-category catalog (development/E2E only) through the real services.
 * Run with: pnpm db:seed:catalog   (uses `tsx --conditions=react-server` so "server-only" resolves).
 * Skips if the business already has catalog attributes.
 */
import "dotenv/config";
import { DEFAULT_BUSINESS_SLUG } from "../src/config/business";
import { db } from "../src/lib/db/client";
import { ensureCatalogDefaults } from "../src/modules/catalog/defaults";
import { loadStaffActor } from "../src/modules/identity/repository";
import { seedCatalog } from "./fixtures/catalog";
import { seedCommerceSamples } from "./fixtures/commerce";
import { seedHomepageSamples } from "./fixtures/content";
import { seedHomepageImages } from "./fixtures/homepage-images";
import { seedSampleProductImages } from "./fixtures/product-images";

if (process.env.APP_ENV === "production") throw new Error("Refusing to seed sample catalog: APP_ENV is production.");

const business = await db.business.findUniqueOrThrow({ where: { slug: DEFAULT_BUSINESS_SLUG } });
await ensureCatalogDefaults(db, business.id, business.currency);
if ((await db.attributeDefinition.count({ where: { businessId: business.id } })) > 0) {
  console.log("Catalog already present; skipping sample catalog.");
} else {
  const ownerStaff = await db.staffMember.findFirstOrThrow({ where: { businessId: business.id, role: { key: "owner" }, status: "ACTIVE" } });
  const actor = await loadStaffActor(db, ownerStaff.userId);
  if (!actor) throw new Error("Owner account is not active.");
  const result = await seedCatalog(actor);
  await seedCommerceSamples(actor);
  console.log(`Seeded sample catalog: ${Object.keys(result.productIds).length} products in ${Object.keys(result.categoryIds).length} categories, sample delivery zones, stock and coupon WELCOME10.`);
}
{
  const ownerStaff = await db.staffMember.findFirstOrThrow({ where: { businessId: business.id, role: { key: "owner" }, status: "ACTIVE" } });
  const actor = await loadStaffActor(db, ownerStaff.userId);
  if (actor && (await seedHomepageSamples(actor))) console.log("Seeded sample homepage content and coupon SEASON15.");
  const photos = actor ? await seedSampleProductImages(actor) : 0;
  if (photos) console.log(`Attached sample photos to ${photos} products.`);
  if (actor && (await seedHomepageImages(actor))) console.log("Attached sample photos to the homepage banners.");
}
await db.$disconnect();
