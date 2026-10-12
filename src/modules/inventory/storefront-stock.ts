import "server-only";
import { db } from "@/lib/db/client";
import { getAvailability } from "./ledger";

/** Fresh (uncached) sellable units per variant for product pages; null means stock is not tracked. */
export async function getVariantStock(businessId: string, variantIds: string[]): Promise<Record<string, number | null>> {
  const availability = await getAvailability(db, businessId, variantIds);
  return Object.fromEntries(variantIds.map((id) => {
    const a = availability.get(id);
    return [id, !a ? 0 : a.trackInventory ? Math.max(0, a.available) : null];
  }));
}
