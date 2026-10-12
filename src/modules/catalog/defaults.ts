import type { PrismaClient } from "@/generated/prisma/client";

export const RETAIL_PRICE_LIST = "RETAIL";

/**
 * Creates the default RETAIL price list, the MAIN warehouse and a 0% default tax class if missing.
 * The tax rate stays 0% (prices tax-inclusive) until the VAT policy is decided.
 */
export async function ensureCatalogDefaults(db: PrismaClient, businessId: string, currency = "BDT") {
  await db.priceList.upsert({
    where: { businessId_code: { businessId, code: RETAIL_PRICE_LIST } },
    create: { businessId, code: RETAIL_PRICE_LIST, name: "Retail", currency, isDefault: true },
    update: {},
  });
  await db.warehouse.upsert({
    where: { businessId_code: { businessId, code: "MAIN" } },
    create: { businessId, code: "MAIN", name: "Main warehouse", isDefault: true },
    update: {},
  });
  await db.taxClass.upsert({
    where: { businessId_code: { businessId, code: "standard" } },
    create: { businessId, code: "standard", name: "Standard VAT", rateBasisPoints: 0, isDefault: true },
    update: {},
  });
}
