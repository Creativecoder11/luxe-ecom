import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Resolves the customer record for an order. One customer per normalized mobile number per business
 * (staff-side dedup, FR-CRM-01). A signed-in user's own customer record is used when it exists.
 *
 * Security: an account is never linked to an existing guest customer just because the phone matches
 * (phones are not verified until SMS OTP exists), otherwise anyone could claim someone else's order
 * history. Customer-facing order lists therefore use Order.placedByUserId, not the phone.
 */
export async function resolveOrderCustomer(
  tx: Tx,
  businessId: string,
  input: { name: string; phoneE164: string; email: string | null; userId: string | null },
): Promise<{ id: string }> {
  if (input.userId) {
    const own = await tx.customer.findUnique({ where: { userId: input.userId }, select: { id: true } });
    if (own) return own;
  }
  const byPhone = await tx.customer.findUnique({ where: { businessId_phoneE164: { businessId, phoneE164: input.phoneE164 } }, select: { id: true, userId: true } });
  if (byPhone) return { id: byPhone.id };
  return tx.customer.create({
    data: { businessId, name: input.name, phoneE164: input.phoneE164, email: input.email, userId: input.userId },
    select: { id: true },
  });
}
