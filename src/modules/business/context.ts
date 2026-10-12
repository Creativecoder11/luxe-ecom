import "server-only";
import { DEFAULT_BUSINESS_SLUG } from "@/config/business";
import { db } from "@/lib/db/client";

let cachedBusinessId: string | undefined;

/** Single-business mode (D-001): resolves the one business every record belongs to. */
export async function getBusinessId(): Promise<string> {
  if (cachedBusinessId) return cachedBusinessId;
  const business = await db.business.findUnique({ where: { slug: DEFAULT_BUSINESS_SLUG }, select: { id: true } });
  if (!business) {
    throw new Error(`Business "${DEFAULT_BUSINESS_SLUG}" not found. Run "pnpm db:seed" (development) or the bootstrap script.`);
  }
  cachedBusinessId = business.id;
  return business.id;
}
