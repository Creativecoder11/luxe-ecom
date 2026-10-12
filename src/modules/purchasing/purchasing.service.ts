import "server-only";
import { z } from "zod";
import { db, HEAVY_TRANSACTION } from "@/lib/db/client";
import { formatDocumentNumber, nextSequenceValue } from "@/lib/db/sequence";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseMajorToMinor } from "@/lib/money";
import { normalizeBdMobile } from "@/lib/phone";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import { applyMovement, getDefaultWarehouseId } from "@/modules/inventory/ledger";
import { movingAverageCost } from "./costing";

// ---------- Suppliers ----------

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name").max(120),
  contactName: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  isActive: z.boolean().default(true),
});

export async function listSuppliers(actor: StaffActor, options: { includeInactive?: boolean } = {}) {
  assertCan(actor, "purchasing.view");
  return db.supplier.findMany({
    where: { businessId: actor.businessId, ...(options.includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchaseOrders: true } } },
  });
}

export async function saveSupplier(actor: StaffActor, id: string | null, raw: unknown) {
  assertCan(actor, "purchasing.manage");
  const input = supplierSchema.parse(raw);
  let phone: string | null = null;
  if (input.phone) {
    const parsed = normalizeBdMobile(input.phone);
    phone = parsed.ok ? parsed.e164 : input.phone; // suppliers may use landlines or foreign numbers
  }
  const existing = id ? await db.supplier.findFirst({ where: { id, businessId: actor.businessId } }) : null;
  if (id && !existing) throw new NotFoundError("Supplier");
  const data = {
    name: input.name,
    contactName: input.contactName || null,
    phone,
    email: input.email || null,
    address: input.address || null,
    notes: input.notes || null,
    isActive: input.isActive,
  };
  return db.$transaction(async (tx) => {
    const saved = existing ? await tx.supplier.update({ where: { id: existing.id }, data }) : await tx.supplier.create({ data: { ...data, businessId: actor.businessId } });
    await recordAudit(tx, actor, { action: existing ? "supplier.updated" : "supplier.created", entityType: "Supplier", entityId: saved.id, before: existing ?? undefined, after: data });
    return saved;
  });
}

// ---------- Purchase orders ----------

const lineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int("Whole units only").min(1, "At least 1").max(1_000_000),
  unitCost: z.string().trim(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  expectedAt: z.string().trim().optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  items: z.array(lineSchema).min(1, "Add at least one item").max(200),
});

async function validateLines(actor: StaffActor, items: z.output<typeof purchaseOrderSchema>["items"]) {
  const errors: Record<string, string> = {};
  const ids = items.map((i) => i.variantId);
  if (new Set(ids).size !== ids.length) errors.items = "Each product variant can appear once; combine the quantities.";
  const variants = await db.productVariant.findMany({ where: { id: { in: ids }, businessId: actor.businessId }, select: { id: true } });
  if (variants.length !== new Set(ids).size) errors.items = "One of the items is not a valid product variant.";
  const lines = items.map((item, i) => {
    const cost = parseMajorToMinor(item.unitCost);
    if (cost === null || cost < 0) errors[`items.${i}.unitCost`] = "Enter a unit cost like 450 or 450.50";
    return { variantId: item.variantId, quantityOrdered: item.quantity, unitCostMinor: cost ?? 0 };
  });
  if (Object.keys(errors).length) throw new ValidationError("Please correct the highlighted fields.", errors);
  return lines;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new ValidationError("Enter a valid date.", { expectedAt: "Enter a valid date" });
  return d;
}

export async function createPurchaseOrder(actor: StaffActor, raw: unknown) {
  assertCan(actor, "purchasing.manage");
  const input = purchaseOrderSchema.parse(raw);
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, businessId: actor.businessId, isActive: true } });
  if (!supplier) throw new ValidationError("Choose an active supplier.", { supplierId: "Choose an active supplier" });
  const lines = await validateLines(actor, input.items);
  const warehouseId = await getDefaultWarehouseId(db, actor.businessId);
  return db.$transaction(async (tx) => {
    const number = formatDocumentNumber("PO", await nextSequenceValue(tx, actor.businessId, "PO"));
    const po = await tx.purchaseOrder.create({
      data: {
        businessId: actor.businessId,
        number,
        supplierId: supplier.id,
        warehouseId,
        expectedAt: parseDate(input.expectedAt),
        notes: input.notes || null,
        createdById: actor.userId,
        items: { create: lines },
      },
    });
    await recordAudit(tx, actor, { action: "purchase_order.created", entityType: "PurchaseOrder", entityId: po.id, after: { number, supplier: supplier.name, lines } });
    return po;
  });
}

async function ownedPurchaseOrder(actor: StaffActor, id: string) {
  const po = await db.purchaseOrder.findFirst({
    where: { id, businessId: actor.businessId },
    include: { items: { include: { variant: { select: { sku: true, title: true, product: { select: { title: true } } } } } }, supplier: true, receipts: { orderBy: { receivedAt: "desc" } } },
  });
  if (!po) throw new NotFoundError("Purchase order");
  return po;
}

export async function getPurchaseOrder(actor: StaffActor, id: string) {
  assertCan(actor, "purchasing.view");
  return ownedPurchaseOrder(actor, id);
}

export async function listPurchaseOrders(actor: StaffActor) {
  assertCan(actor, "purchasing.view");
  return db.purchaseOrder.findMany({
    where: { businessId: actor.businessId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { supplier: { select: { name: true } }, items: { select: { quantityOrdered: true, quantityReceived: true, unitCostMinor: true } } },
  });
}

/** Approves a draft and sends it to the supplier (separate permission from creating it). */
export async function placePurchaseOrder(actor: StaffActor, id: string) {
  assertCan(actor, "purchasing.approve");
  const po = await ownedPurchaseOrder(actor, id);
  if (po.status !== "DRAFT") throw new ConflictError("Only draft purchase orders can be placed.");
  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id }, data: { status: "ORDERED", orderedAt: new Date() } });
    await recordAudit(tx, actor, { action: "purchase_order.placed", entityType: "PurchaseOrder", entityId: id, before: { status: "DRAFT" }, after: { status: "ORDERED" } });
  });
}

export async function cancelPurchaseOrder(actor: StaffActor, id: string, reason: string) {
  assertCan(actor, "purchasing.manage");
  const po = await ownedPurchaseOrder(actor, id);
  if (!["DRAFT", "ORDERED"].includes(po.status)) throw new ConflictError("Purchase orders with received goods cannot be cancelled.");
  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    await recordAudit(tx, actor, { action: "purchase_order.cancelled", entityType: "PurchaseOrder", entityId: id, before: { status: po.status }, after: { status: "CANCELLED" }, reason: reason || null });
  });
}

export const receiveSchema = z.object({
  notes: z.string().trim().max(1000).optional().default(""),
  lines: z.array(z.object({ itemId: z.string(), quantity: z.coerce.number().int("Whole units only").min(0) })).min(1),
});

/**
 * Receives goods against an ordered PO: stock RECEIPT movements, moving-average cost update and
 * received quantities, all in one transaction. Over-receiving is rejected.
 */
export async function receivePurchaseOrder(actor: StaffActor, id: string, raw: unknown) {
  assertCan(actor, "purchasing.manage");
  const input = receiveSchema.parse(raw);
  const po = await ownedPurchaseOrder(actor, id);
  if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status)) throw new ConflictError("Only placed purchase orders can be received.");
  const lines = input.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) throw new ValidationError("Enter a received quantity for at least one item.");
  const errors: Record<string, string> = {};
  for (const line of lines) {
    const item = po.items.find((i) => i.id === line.itemId);
    if (!item) errors[`lines.${line.itemId}`] = "Unknown item";
    else if (item.quantityReceived + line.quantity > item.quantityOrdered) {
      errors[`lines.${line.itemId}`] = `Only ${item.quantityOrdered - item.quantityReceived} left to receive`;
    }
  }
  if (Object.keys(errors).length) throw new ValidationError("Received quantities exceed what was ordered.", errors);

  return db.$transaction(async (tx) => {
    const number = formatDocumentNumber("GRN", await nextSequenceValue(tx, actor.businessId, "GRN"));
    const receipt = await tx.goodsReceipt.create({
      data: { businessId: actor.businessId, number, purchaseOrderId: po.id, warehouseId: po.warehouseId, notes: input.notes || null, receivedById: actor.userId },
    });
    for (const line of lines) {
      const item = po.items.find((i) => i.id === line.itemId)!;
      const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId }, select: { costMinor: true } });
      const before = await tx.stockBalance.findUnique({ where: { warehouseId_variantId: { warehouseId: po.warehouseId, variantId: item.variantId } } });
      await applyMovement(tx, {
        businessId: actor.businessId,
        warehouseId: po.warehouseId,
        variantId: item.variantId,
        type: "RECEIPT",
        onHandDelta: line.quantity,
        unitCostMinor: item.unitCostMinor,
        sourceType: "GoodsReceipt",
        sourceId: receipt.id,
        actor: { type: "STAFF", id: actor.userId },
      });
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { costMinor: movingAverageCost(before?.onHand ?? 0, variant.costMinor, line.quantity, item.unitCostMinor) },
      });
      await tx.goodsReceiptItem.create({ data: { receiptId: receipt.id, variantId: item.variantId, purchaseOrderItemId: item.id, quantity: line.quantity, unitCostMinor: item.unitCostMinor } });
      await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { quantityReceived: { increment: line.quantity } } });
    }
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
    const status = items.every((i) => i.quantityReceived >= i.quantityOrdered) ? "RECEIVED" : "PARTIALLY_RECEIVED";
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status } });
    await recordAudit(tx, actor, { action: "purchase_order.received", entityType: "PurchaseOrder", entityId: po.id, after: { receipt: number, lines, status } });
    return receipt;
  }, HEAVY_TRANSACTION);
}

/** Variant picker data for PO lines. */
export async function listPurchasableVariants(actor: StaffActor) {
  assertCan(actor, "purchasing.view");
  const variants = await db.productVariant.findMany({
    where: { businessId: actor.businessId, product: { status: { not: "ARCHIVED" } } },
    orderBy: [{ product: { title: "asc" } }, { position: "asc" }],
    select: { id: true, sku: true, title: true, costMinor: true, product: { select: { title: true, productType: true } } },
  });
  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    label: v.product.productType === "SIMPLE" ? v.product.title : `${v.product.title} · ${v.title}`,
    costMinor: v.costMinor,
  }));
}
