import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

export class InsufficientStockError extends DomainError {
  constructor(readonly variantIds: string[]) {
    super("Not enough stock for one or more items.", "INSUFFICIENT_STOCK");
  }
}

export type MovementType = "OPENING_BALANCE" | "RECEIPT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE" | "RESERVE" | "RELEASE" | "SALE" | "RETURN_RESTOCK";

export interface MovementInput {
  businessId: string;
  warehouseId: string;
  variantId: string;
  type: MovementType;
  onHandDelta: number;
  reservedDelta?: number;
  reason?: string | null;
  note?: string | null;
  unitCostMinor?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  actor: { type: "STAFF" | "CUSTOMER" | "SYSTEM"; id: string | null };
}

/**
 * The only way stock changes. Applies the deltas with a conditional UPDATE that succeeds only if
 * on-hand and reserved stay non-negative and reserved ≤ on-hand (no overselling, even under
 * concurrency: the row lock serializes competing updates), then appends the ledger row.
 * Throws InsufficientStockError when the guard fails.
 */
export async function applyMovement(tx: Tx, input: MovementInput): Promise<{ onHand: number; reserved: number }> {
  const reservedDelta = input.reservedDelta ?? 0;
  if (!Number.isInteger(input.onHandDelta) || !Number.isInteger(reservedDelta)) throw new RangeError("stock deltas must be integers");
  await tx.$executeRaw`
    INSERT INTO "stock_balances" ("id", "warehouseId", "variantId", "onHand", "reserved", "updatedAt")
    VALUES (gen_random_uuid()::text, ${input.warehouseId}, ${input.variantId}, 0, 0, now())
    ON CONFLICT ("warehouseId", "variantId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ onHand: number; reserved: number }[]>`
    UPDATE "stock_balances"
    SET "onHand" = "onHand" + ${input.onHandDelta}, "reserved" = "reserved" + ${reservedDelta}, "updatedAt" = now()
    WHERE "warehouseId" = ${input.warehouseId} AND "variantId" = ${input.variantId}
      AND "onHand" + ${input.onHandDelta} >= 0
      AND "reserved" + ${reservedDelta} >= 0
      AND "reserved" + ${reservedDelta} <= "onHand" + ${input.onHandDelta}
    RETURNING "onHand", "reserved"`;
  const row = rows[0];
  if (!row) throw new InsufficientStockError([input.variantId]);
  await tx.stockMovement.create({
    data: {
      businessId: input.businessId,
      warehouseId: input.warehouseId,
      variantId: input.variantId,
      type: input.type,
      onHandDelta: input.onHandDelta,
      reservedDelta,
      onHandAfter: row.onHand,
      reservedAfter: row.reserved,
      reason: input.reason ?? null,
      note: input.note ?? null,
      unitCostMinor: input.unitCostMinor ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id,
    },
  });
  return row;
}

export async function getDefaultWarehouseId(client: Pick<PrismaClient, "warehouse"> | Tx, businessId: string): Promise<string> {
  const warehouse = await client.warehouse.findFirst({ where: { businessId, isDefault: true, isActive: true }, select: { id: true } });
  if (!warehouse) throw new Error("No default warehouse: run the seed or bootstrap script.");
  return warehouse.id;
}

export interface Availability {
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  /** Units that can be sold now; Infinity for untracked variants. */
  available: number;
}

/** Availability per variant in the default warehouse (Release 1 is single-warehouse, D-014). */
export async function getAvailability(client: PrismaClient | Tx, businessId: string, variantIds: readonly string[]): Promise<Map<string, Availability>> {
  const out = new Map<string, Availability>();
  if (variantIds.length === 0) return out;
  const warehouseId = await getDefaultWarehouseId(client, businessId);
  const variants = await client.productVariant.findMany({
    where: { id: { in: [...variantIds] }, businessId },
    select: { id: true, trackInventory: true, stock: { where: { warehouseId }, select: { onHand: true, reserved: true } } },
  });
  for (const v of variants) {
    const onHand = v.stock[0]?.onHand ?? 0;
    const reserved = v.stock[0]?.reserved ?? 0;
    out.set(v.id, { trackInventory: v.trackInventory, onHand, reserved, available: v.trackInventory ? onHand - reserved : Number.POSITIVE_INFINITY });
  }
  return out;
}
