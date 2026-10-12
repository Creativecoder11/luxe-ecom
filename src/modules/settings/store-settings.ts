import "server-only";
import { db } from "@/lib/db/client";
import { getCommerceSettings } from "./commerce.service";

/** Storefront read of the owner's commerce settings (COD, guest checkout, VAT mode). */
export function getCommerceSettingsForStore(businessId: string) {
  return getCommerceSettings(db, businessId);
}
