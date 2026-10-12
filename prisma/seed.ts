/**
 * Development seed (synthetic data only; refuses to run in production):
 *   - the single business and its settings
 *   - system roles from the permission matrix
 *   - a development owner account (SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD)
 * Catalog fixtures are added in prisma/seed-catalog.ts.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_BUSINESS_SLUG } from "../src/config/business";
import { ensureCatalogDefaults } from "../src/modules/catalog/defaults";
import { createOwner, ensureSystemRoles } from "../src/modules/identity/bootstrap";

if (process.env.APP_ENV === "production") {
  throw new Error("Refusing to seed: APP_ENV is production. Use `pnpm bootstrap:owner` instead.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Luxe";
  const business = await prisma.business.upsert({
    where: { slug: DEFAULT_BUSINESS_SLUG },
    update: {},
    create: { slug: DEFAULT_BUSINESS_SLUG, name: storeName, settings: { create: { storeName } } },
  });
  await ensureSystemRoles(prisma, business.id);
  await ensureCatalogDefaults(prisma, business.id, business.currency);

  const email = process.env.SEED_OWNER_EMAIL || "owner@example.test";
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password || password.length < 10) throw new Error("Set SEED_OWNER_PASSWORD (10+ characters) in .env");
  const owner = await createOwner(prisma, business.id, { email, name: "Development Owner", password, mustChangePassword: false });

  console.log(`Business "${business.name}" ready with system roles.`);
  console.log(owner.created ? `Created development owner ${email}.` : `Owner ${email} already exists (unchanged).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
