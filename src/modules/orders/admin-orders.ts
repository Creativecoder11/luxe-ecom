import "server-only";
import type { OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/errors";
import { minorDigits } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { assertCan, can, type StaffActor } from "@/modules/identity/actor";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, SOURCE_LABEL } from "./labels";

export const ADMIN_ORDERS_PAGE_SIZE = 25;
export const ADMIN_ORDERS_PAGE_SIZES = [10, 25, 50, 100] as const;
export const ADMIN_ORDERS_EXPORT_LIMIT = 5000;

const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

/** Status groups for the summary cards; IN_PROGRESS is also accepted as a status filter value. */
export const IN_PROGRESS_STATUSES: OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"];
/** Finished outcomes that count towards a customer's delivery success rate. */
const SUCCESS_STATUSES: OrderStatus[] = ["DELIVERED", "PARTIALLY_RETURNED"];
const FAILURE_STATUSES: OrderStatus[] = ["CANCELLED", "DELIVERY_FAILED", "RETURNED"];

export const ADMIN_ORDER_SORTS = { number: "number", customer: "contactName", status: "status", total: "totalMinor", date: "placedAt" } as const;
export type AdminOrderSort = keyof typeof ADMIN_ORDER_SORTS;

export interface AdminOrderFilters {
  q?: string;
  /** An OrderStatus, or "IN_PROGRESS" for every confirmed-but-not-delivered status. */
  status?: string;
  paymentStatus?: string;
  /** YYYY-MM-DD, business time (Asia/Dhaka). */
  date?: string;
  /** Major units as typed by staff (e.g. "1500"). */
  minTotal?: string;
  maxTotal?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

function toMinor(major: string | undefined): number | undefined {
  if (!major?.trim()) return undefined;
  const n = Number(major);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 10 ** minorDigits("BDT"));
}

function buildWhere(actor: StaffActor, filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const q = filters.q?.trim();
  const status =
    filters.status === "IN_PROGRESS"
      ? { in: IN_PROGRESS_STATUSES }
      : ORDER_STATUSES.includes(filters.status as OrderStatus)
        ? (filters.status as OrderStatus)
        : undefined;
  const paymentStatus = PAYMENT_STATUSES.includes(filters.paymentStatus as PaymentStatus) ? (filters.paymentStatus as PaymentStatus) : undefined;
  const day = filters.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date) ? new Date(`${filters.date}T00:00:00+06:00`) : undefined;
  const min = toMinor(filters.minTotal);
  const max = toMinor(filters.maxTotal);
  return {
    businessId: actor.businessId,
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(day && !Number.isNaN(day.getTime()) ? { placedAt: { gte: day, lt: new Date(day.getTime() + 86_400_000) } } : {}),
    ...(min !== undefined || max !== undefined ? { totalMinor: { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) } } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { contactPhoneE164: { contains: q.replace(/^0/, "") } }] } : {}),
  };
}

function buildOrderBy(filters: AdminOrderFilters): Prisma.OrderOrderByWithRelationInput[] {
  const field = ADMIN_ORDER_SORTS[filters.sort as AdminOrderSort] ?? "placedAt";
  const dir = filters.dir === "asc" ? "asc" : "desc";
  return field === "placedAt" ? [{ placedAt: dir }] : [{ [field]: dir }, { placedAt: "desc" }];
}

export interface CustomerSuccessRate {
  /** null when the customer has no finished (delivered/cancelled/returned) orders yet. */
  rate: number | null;
  delivered: number;
  finished: number;
  /** Outcomes of the latest finished orders, newest first. */
  recent: boolean[];
  recentRate: number | null;
}

/** Delivery success per customer: delivered ÷ finished orders, plus their latest five outcomes. */
async function customerSuccessRates(customerIds: string[]): Promise<Map<string, CustomerSuccessRate>> {
  const finishedStatuses = [...SUCCESS_STATUSES, ...FAILURE_STATUSES];
  const [grouped, recents] = await Promise.all([
    db.order.groupBy({ by: ["customerId", "status"], where: { customerId: { in: customerIds }, status: { in: finishedStatuses } }, _count: { _all: true } }),
    Promise.all(
      customerIds.map((customerId) =>
        db.order.findMany({ where: { customerId, status: { in: finishedStatuses } }, orderBy: { placedAt: "desc" }, take: 5, select: { status: true } }),
      ),
    ),
  ]);
  const result = new Map<string, CustomerSuccessRate>();
  customerIds.forEach((customerId, i) => {
    let delivered = 0;
    let finished = 0;
    for (const g of grouped) {
      if (g.customerId !== customerId) continue;
      finished += g._count._all;
      if (SUCCESS_STATUSES.includes(g.status)) delivered += g._count._all;
    }
    const recent = (recents[i] ?? []).map((o) => SUCCESS_STATUSES.includes(o.status));
    result.set(customerId, {
      rate: finished ? Math.round((delivered / finished) * 100) : null,
      delivered,
      finished,
      recent,
      recentRate: recent.length ? Math.round((recent.filter(Boolean).length / recent.length) * 100) : null,
    });
  });
  return result;
}

/** Order list (read-only until Gate 4). Contact details are masked unless the actor holds customers.pii. */
export async function listAdminOrders(actor: StaffActor, filters: AdminOrderFilters) {
  assertCan(actor, "orders.view");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = ADMIN_ORDERS_PAGE_SIZES.includes(filters.pageSize as (typeof ADMIN_ORDERS_PAGE_SIZES)[number]) ? filters.pageSize! : ADMIN_ORDERS_PAGE_SIZE;
  const where = buildWhere(actor, filters);
  const pii = can(actor, "customers.pii");
  const [rows, total, statusGroups] = await Promise.all([
    db.order.findMany({ where, orderBy: buildOrderBy(filters), skip: (page - 1) * pageSize, take: pageSize, include: { items: { select: { quantity: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { businessId: actor.businessId }, _count: { _all: true } }),
  ]);
  const rates = await customerSuccessRates([...new Set(rows.map((o) => o.customerId))]);
  const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Partial<Record<OrderStatus, number>>;
  const sum = (statuses: OrderStatus[]) => statuses.reduce((n, s) => n + (statusCounts[s] ?? 0), 0);
  return {
    rows: rows.map((o) => ({ ...o, contactPhoneDisplay: pii ? o.contactPhoneE164 : maskPhone(o.contactPhoneE164), successRate: rates.get(o.customerId)! })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      all: sum(ORDER_STATUSES),
      pending: statusCounts.PENDING_CONFIRMATION ?? 0,
      inProgress: sum(IN_PROGRESS_STATUSES),
      delivered: statusCounts.DELIVERED ?? 0,
      cancelled: statusCounts.CANCELLED ?? 0,
    },
  };
}

/** CSV of the orders matching the list filters (newest first, capped at ADMIN_ORDERS_EXPORT_LIMIT). */
export async function exportAdminOrdersCsv(actor: StaffActor, filters: AdminOrderFilters): Promise<{ csv: string; rowCount: number }> {
  assertCan(actor, "orders.export");
  const pii = can(actor, "customers.pii");
  const rows = await db.order.findMany({ where: buildWhere(actor, filters), orderBy: buildOrderBy(filters), take: ADMIN_ORDERS_EXPORT_LIMIT });
  const major = (minor: number) => (minor / 10 ** minorDigits("BDT")).toFixed(minorDigits("BDT"));
  const csv = toCsv(rows, [
    { header: "order_number", value: (o) => o.number },
    { header: "placed_at", value: (o) => o.placedAt },
    { header: "status", value: (o) => ORDER_STATUS_LABEL[o.status] },
    { header: "payment_status", value: (o) => PAYMENT_STATUS_LABEL[o.paymentStatus] },
    { header: "source", value: (o) => SOURCE_LABEL[o.source] },
    { header: "customer_name", value: (o) => o.contactName },
    { header: "customer_phone", value: (o) => (pii ? o.contactPhoneE164 : maskPhone(o.contactPhoneE164)) },
    { header: "subtotal", value: (o) => major(o.subtotalMinor) },
    { header: "discount", value: (o) => major(o.discountMinor) },
    { header: "shipping", value: (o) => major(o.shippingMinor) },
    { header: "total", value: (o) => major(o.totalMinor) },
    { header: "currency", value: (o) => o.currency },
    { header: "note", value: (o) => o.customerNote },
  ]);
  return { csv, rowCount: rows.length };
}

export async function getAdminOrder(actor: StaffActor, id: string) {
  assertCan(actor, "orders.view");
  const order = await db.order.findFirst({
    where: { id, businessId: actor.businessId },
    include: { items: { orderBy: { id: "asc" } }, history: { orderBy: { createdAt: "asc" } }, payments: true, reservations: true },
  });
  if (!order) throw new NotFoundError("Order");
  const pii = can(actor, "customers.pii");
  const address = order.shippingAddress as Record<string, string | null>;
  return {
    ...order,
    contactPhoneDisplay: pii ? order.contactPhoneE164 : maskPhone(order.contactPhoneE164),
    contactEmailDisplay: pii ? order.contactEmail : order.contactEmail ? "•••" : null,
    addressDisplay: pii ? address : { ...address, addressLine: "••• (requires customer PII permission)", phone: maskPhone(String(address.phone ?? "")) },
  };
}
