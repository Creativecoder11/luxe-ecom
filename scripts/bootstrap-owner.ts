/**
 * Production-safe bootstrap: creates the business (if missing), system roles and the first owner.
 * Usage: pnpm bootstrap:owner --email owner@shop.com --name "Owner Name" [--business "Store Name"]
 * Prints a one-time temporary password; the owner must change it at first sign-in.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_BUSINESS_SLUG } from "../src/config/business";
import { ensureCatalogDefaults } from "../src/modules/catalog/defaults";
import { createOwner, ensureSystemRoles } from "../src/modules/identity/bootstrap";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, business: { type: "string" } },
});
if (!values.email || !values.name) {
  console.error('Usage: pnpm bootstrap:owner --email owner@shop.com --name "Owner Name" [--business "Store Name"]');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const storeName = values.business || process.env.NEXT_PUBLIC_STORE_NAME || "Luxe";
  const business = await prisma.business.upsert({
    where: { slug: DEFAULT_BUSINESS_SLUG },
    update: {},
    create: { slug: DEFAULT_BUSINESS_SLUG, name: storeName, settings: { create: { storeName } } },
  });
  await ensureSystemRoles(prisma, business.id);
  await ensureCatalogDefaults(prisma, business.id, business.currency);
  const temporaryPassword = randomBytes(16).toString("base64url");
  const result = await createOwner(prisma, business.id, {
    email: values.email!,
    name: values.name!,
    password: temporaryPassword,
    mustChangePassword: true,
  });
  if (!result.created) {
    console.log(`An account for ${values.email} already exists; nothing changed.`);
    return;
  }
  console.log(`Owner created: ${values.email}`);
  console.log(`Temporary password (shown once): ${temporaryPassword}`);
  console.log("Sign in at /admin/login; you will be asked to choose a new password.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
