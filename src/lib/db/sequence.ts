import type { Prisma } from "@/generated/prisma/client";

/**
 * Atomically reserves the next number in a per-business sequence (gap-free within committed
 * transactions: the row lock is held until the caller's transaction ends).
 */
export async function nextSequenceValue(tx: Prisma.TransactionClient, businessId: string, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "document_sequences" ("businessId", "key", "nextValue") VALUES (${businessId}, ${key}, 2)
    ON CONFLICT ("businessId", "key") DO UPDATE SET "nextValue" = "document_sequences"."nextValue" + 1
    RETURNING "nextValue" - 1 AS value`;
  return Number(rows[0]!.value);
}

export function formatDocumentNumber(prefix: string, value: number, width = 6): string {
  return `${prefix}-${String(value).padStart(width, "0")}`;
}
