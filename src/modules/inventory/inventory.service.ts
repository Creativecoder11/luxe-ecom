import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import { getCommerceSettings } from "@/modules/settings/commerce.service";
import { applyMovement, getDefaultWarehouseId } from "./ledger";

export const ADJUSTMENT_REASONS = {
  OPENING_BALANCE: "Opening balance / initial count",
  COUNT_CORRECTION: "Stock count correction",
  DAMAGED: "Damaged or expired",
  FOUND: "Found stock",
  LOST: "Lost or stolen",
  OTHER: "Other (note required)",
} as const;

export type AdjustmentReason = keyof typeof ADJUSTMENT_REASONS;

export const adjustmentSchema = z
  .object({
    variantId: z.string().min(1),
    quantity: z.coerce.number().int("Enter a whole number").refine((n) => n !== 0, "Enter a non-zero quantity").refine((n) => Math.abs(n) <= 100_000, "Too large"),
    reason: z.enum(Object.keys(ADJUSTMENT_REASONS) as [AdjustmentReason, ...AdjustmentReason[]]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "OTHER" && !v.note) ctx.addIssue({ code: "custom", path: ["note"], message: "Explain the adjustment" });
    if ((v.reason === "DAMAGED" || v.reason === "LOST") && v.quantity > 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Damaged or lost stock is a negative quantity" });
    if ((v.reason === "FOUND" || v.reason === "OPENING_BALANCE") && v.quantity < 0) ctx.addIssue({ code: "custom", path: ["quantity"], message: "This reason adds stock" });
  });

/** Manual stock adjustment with a reason; cannot push available stock below zero. */
export async function adjustStock(actor: StaffActor, raw: unknown) {
  assertCan(actor, "inventory.adjust");
  const input = adjustmentSchema.parse(raw);
  const variant = await db.productVariant.findFirst({ where: { id: input.variantId, businessId: actor.businessId }, select: { id: true, sku: true, trackInventory: true } });
  if (!variant) throw new NotFoundError("Variant");
  if (!variant.trackInventory) throw new ValidationError("Stock is not tracked for this variant.");
  const warehouseId = await getDefaultWarehouseId(db, actor.businessId);
  const type = input.reason === "OPENING_BALANCE" ? "OPENING_BALANCE" : input.reason === "DAMAGED" ? "DAMAGE" : input.quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";

  return db.$transaction(async (tx) => {
    const result = await applyMovement(tx, {
      businessId: actor.businessId,
      warehouseId,
      variantId: variant.id,
      type,
      onHandDelta: input.quantity,
      reason: input.reason,
      note: input.note || null,
      sourceType: "Adjustment",
      actor: { type: "STAFF", id: actor.userId },
    });
    await recordAudit(tx, actor, {
      action: "stock.adjusted",
      entityType: "ProductVariant",
      entityId: variant.id,
      after: { sku: variant.sku, quantity: input.quantity, reason: input.reason, note: input.note, onHandAfter: result.onHand },
      reason: input.note || ADJUSTMENT_REASONS[input.reason],
    });
    return result;
  });
}

export type StockFilter = "all" | "low" | "out";

export interface StockRow {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  trackInventory: boolean;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  status: "ok" | "low" | "out" | "untracked";
}

export const STOCK_PAGE_SIZE = 50;

export async function listStock(actor: StaffActor, filters: { q?: string; filter?: StockFilter; page?: number }) {
  assertCan(actor, "inventory.view");
  const settings = await getCommerceSettings(db, actor.businessId);
  const warehouseId = await getDefaultWarehouseId(db, actor.businessId);
  const q = filters.q?.trim();
  const where: Prisma.ProductVariantWhereInput = {
    businessId: actor.businessId,
    product: { status: { not: "ARCHIVED" } },
    ...(q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { product: { title: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const variants = await db.productVariant.findMany({
    where,
    orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      sku: true,
      title: true,
      trackInventory: true,
      lowStockThreshold: true,
      product: { select: { id: true, title: true, productType: true } },
      stock: { where: { warehouseId }, select: { onHand: true, reserved: true } },
    },
  });
  const rows: StockRow[] = variants.map((v) => {
    const onHand = v.stock[0]?.onHand ?? 0;
    const reserved = v.stock[0]?.reserved ?? 0;
    const available = onHand - reserved;
    const threshold = v.lowStockThreshold ?? settings.lowStockThreshold;
    const status: StockRow["status"] = !v.trackInventory ? "untracked" : available <= 0 ? "out" : available <= threshold ? "low" : "ok";
    return {
      variantId: v.id,
      productId: v.product.id,
      productTitle: v.product.title,
      variantTitle: v.product.productType === "SIMPLE" ? "" : v.title,
      sku: v.sku,
      trackInventory: v.trackInventory,
      onHand,
      reserved,
      available,
      threshold,
      status,
    };
  });
  const filtered = filters.filter === "low" ? rows.filter((r) => r.status === "low" || r.status === "out") : filters.filter === "out" ? rows.filter((r) => r.status === "out") : rows;
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  return {
    rows: filtered.slice((page - 1) * STOCK_PAGE_SIZE, page * STOCK_PAGE_SIZE),
    total: filtered.length,
    page,
    pageCount: Math.max(1, Math.ceil(filtered.length / STOCK_PAGE_SIZE)),
    counts: {
      low: rows.filter((r) => r.status === "low").length,
      out: rows.filter((r) => r.status === "out").length,
    },
  };
}

export const MOVEMENTS_PAGE_SIZE = 50;

export async function listMovements(actor: StaffActor, filters: { variantId?: string; page?: number }) {
  assertCan(actor, "inventory.view");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const where: Prisma.StockMovementWhereInput = { businessId: actor.businessId, ...(filters.variantId ? { variantId: filters.variantId } : {}) };
  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MOVEMENTS_PAGE_SIZE,
      take: MOVEMENTS_PAGE_SIZE,
      include: { variant: { select: { sku: true, title: true, product: { select: { title: true } } } } },
    }),
    db.stockMovement.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))];
  const users = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return {
    rows: rows.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? null) : null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE)),
  };
}
