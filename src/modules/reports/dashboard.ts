import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { mediaUrl } from "@/lib/media";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import {
  BUSINESS_UTC_OFFSET_MS,
  monthKeysThisYear,
  NON_REVENUE_STATUSES,
  OPEN_STATUSES,
  percentChange,
  periodFor,
  ratioPercent,
  type Period,
  type RangeKey,
} from "./definitions";

/**
 * Dashboard figures (PRD §15), all computed from records at request time. Nothing here is
 * estimated, sampled or invented: a figure without data is returned as 0/null and the UI says so.
 *
 * Timestamps are stored as UTC without a zone; bounds are passed as UTC text and cast, so the
 * database session time zone never shifts a boundary.
 */

const NON_REVENUE = [...NON_REVENUE_STATUSES] as string[];
const ts = (d: Date) => d.toISOString().slice(0, 23).replace("T", " ");
const LOCAL = Prisma.raw(`'${BUSINESS_UTC_OFFSET_MS / 3_600_000} hours'::interval`);

function within(column: string, start: Date | null, end: Date): Prisma.Sql {
  const col = Prisma.raw(column);
  return start ? Prisma.sql`AND ${col} >= ${ts(start)}::timestamp AND ${col} < ${ts(end)}::timestamp` : Prisma.sql`AND ${col} < ${ts(end)}::timestamp`;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

async function salesTotals(businessId: string, start: Date | null, end: Date) {
  const [row] = await db.$queryRaw<{ revenue: bigint | null; orders: bigint }[]>`
    SELECT SUM("totalMinor") AS revenue, COUNT(*) AS orders FROM orders
    WHERE "businessId" = ${businessId} AND status::text <> ALL(${NON_REVENUE}) ${within('"placedAt"', start, end)}`;
  const revenue = n(row?.revenue);
  const orders = n(row?.orders);
  return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
}

async function grossProfit(businessId: string, start: Date | null, end: Date) {
  const [row] = await db.$queryRaw<{ profit: bigint | null; costed: bigint; uncosted: bigint }[]>`
    SELECT SUM(oi."lineTotalMinor" - oi."taxMinor" - oi."unitCostMinor" * oi.quantity) FILTER (WHERE oi."unitCostMinor" IS NOT NULL) AS profit,
           COUNT(*) FILTER (WHERE oi."unitCostMinor" IS NOT NULL) AS costed,
           COUNT(*) FILTER (WHERE oi."unitCostMinor" IS NULL) AS uncosted
    FROM order_items oi JOIN orders o ON o.id = oi."orderId"
    WHERE o."businessId" = ${businessId} AND o.status::text <> ALL(${NON_REVENUE}) ${within('o."placedAt"', start, end)}`;
  return { grossProfit: n(row?.profit), costedLines: n(row?.costed), uncostedLines: n(row?.uncosted) };
}

export interface Delta {
  /** Percentage change vs the comparison period; null when there is nothing to compare with. */
  percent: number | null;
  label: string | null;
}

function delta(current: number, previous: number | null, period: Period): Delta {
  return { percent: previous === null ? null : percentChange(current, previous), label: period.comparisonLabel };
}

export async function getSalesSummary(actor: StaffActor, range: RangeKey) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const [current, previous, profit, previousProfit] = await Promise.all([
    salesTotals(actor.businessId, period.start, period.end),
    period.previous ? salesTotals(actor.businessId, period.previous.start, period.previous.end) : null,
    grossProfit(actor.businessId, period.start, period.end),
    period.previous ? grossProfit(actor.businessId, period.previous.start, period.previous.end) : null,
  ]);
  return {
    revenue: { value: current.revenue, delta: delta(current.revenue, previous?.revenue ?? null, period) },
    orders: { value: current.orders, delta: delta(current.orders, previous?.orders ?? null, period) },
    aov: { value: current.aov, delta: delta(current.aov, previous?.aov ?? null, period) },
    grossProfit: { value: profit.grossProfit, delta: delta(profit.grossProfit, previousProfit?.grossProfit ?? null, period), ...profit },
  };
}

export async function getCustomerSummary(actor: StaffActor, range: RangeKey) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const oneHourAgo = new Date(period.end.getTime() - 60 * 60 * 1000);
  const [total, top, repeat, carts, websiteOrders] = await Promise.all([
    db.customer.count({ where: { businessId: actor.businessId } }),
    db.$queryRaw<{ id: string; name: string; spent: bigint; orders: bigint }[]>`
      SELECT c.id, c.name, SUM(o."totalMinor") AS spent, COUNT(*) AS orders
      FROM orders o JOIN customers c ON c.id = o."customerId"
      WHERE o."businessId" = ${actor.businessId} AND o.status::text <> ALL(${NON_REVENUE}) ${within('o."placedAt"', period.start, period.end)}
      GROUP BY c.id, c.name ORDER BY spent DESC, c.id LIMIT 5`,
    db.$queryRaw<{ buyers: bigint; repeaters: bigint }[]>`
      SELECT COUNT(*) AS buyers, COUNT(*) FILTER (WHERE k >= 2) AS repeaters FROM (
        SELECT "customerId", COUNT(*) AS k FROM orders
        WHERE "businessId" = ${actor.businessId} AND status::text <> ALL(${NON_REVENUE}) GROUP BY "customerId") t`,
    db.$queryRaw<{ abandoned: bigint }[]>`
      SELECT COUNT(*) AS abandoned FROM carts c
      WHERE c."businessId" = ${actor.businessId} AND EXISTS (SELECT 1 FROM cart_items i WHERE i."cartId" = c.id)
        ${within('c."updatedAt"', period.start, oneHourAgo)}`,
    db.$queryRaw<{ k: bigint }[]>`
      SELECT COUNT(*) AS k FROM orders WHERE "businessId" = ${actor.businessId} AND source = 'WEBSITE' AND status::text <> 'DRAFT'
        ${within('"placedAt"', period.start, period.end)}`,
  ]);
  const abandoned = n(carts[0]?.abandoned);
  const checkedOut = n(websiteOrders[0]?.k);
  return {
    total,
    top: top.map((t) => ({ id: t.id, name: t.name, spentMinor: n(t.spent), orders: n(t.orders) })),
    /** Carts with items left untouched for an hour or more ÷ (those carts + website orders), same period. */
    cartAbandonmentPercent: ratioPercent(abandoned, abandoned + checkedOut),
    abandonedCarts: abandoned,
    /** Customers with 2+ sales orders ÷ customers with 1+, all time. */
    repeatPurchasePercent: ratioPercent(n(repeat[0]?.repeaters), n(repeat[0]?.buyers)),
  };
}

export interface MonthPoint {
  key: string;
  label: string;
}

/** Revenue per customer, new (first-order) customers and channel split for each month of this year. */
export async function getMonthlyTrends(actor: StaffActor) {
  assertCan(actor, "reports.view");
  const keys = monthKeysThisYear();
  const yearStart = new Date(Date.UTC(Number(keys[0]!.slice(0, 4)), 0, 1) - BUSINESS_UTC_OFFSET_MS);
  const now = new Date();
  const [monthly, firstOrders] = await Promise.all([
    db.$queryRaw<{ month: string; website: bigint | null; other: bigint | null; customers: bigint }[]>`
      SELECT to_char("placedAt" + ${LOCAL}, 'YYYY-MM') AS month,
             SUM("totalMinor") FILTER (WHERE source = 'WEBSITE') AS website,
             SUM("totalMinor") FILTER (WHERE source <> 'WEBSITE') AS other,
             COUNT(DISTINCT "customerId") AS customers
      FROM orders
      WHERE "businessId" = ${actor.businessId} AND status::text <> ALL(${NON_REVENUE}) ${within('"placedAt"', yearStart, now)}
      GROUP BY 1`,
    db.$queryRaw<{ month: string; k: bigint }[]>`
      SELECT to_char(first + ${LOCAL}, 'YYYY-MM') AS month, COUNT(*) AS k FROM (
        SELECT MIN("placedAt") AS first FROM orders
        WHERE "businessId" = ${actor.businessId} AND status::text <> ALL(${NON_REVENUE}) GROUP BY "customerId") f
      WHERE first >= ${ts(yearStart)}::timestamp
      GROUP BY 1`,
  ]);
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  const newByMonth = new Map(firstOrders.map((f) => [f.month, n(f.k)]));
  return keys.map((key) => {
    const m = byMonth.get(key);
    const website = n(m?.website);
    const other = n(m?.other);
    const customers = n(m?.customers);
    return {
      key,
      month: Number(key.slice(5)) - 1,
      websiteMinor: website,
      otherMinor: other,
      revenuePerCustomerMinor: customers ? Math.round((website + other) / customers) : 0,
      newCustomers: newByMonth.get(key) ?? 0,
    };
  });
}

/** Revenue and gross profit per calendar year (last five years with orders). */
export async function getYearlyTotals(actor: StaffActor) {
  assertCan(actor, "reports.view");
  const rows = await db.$queryRaw<{ year: string; revenue: bigint | null; profit: bigint | null }[]>`
    SELECT y.year, y.revenue, p.profit FROM (
      SELECT to_char("placedAt" + ${LOCAL}, 'YYYY') AS year, SUM("totalMinor") AS revenue FROM orders
      WHERE "businessId" = ${actor.businessId} AND status::text <> ALL(${NON_REVENUE}) GROUP BY 1) y
    LEFT JOIN (
      SELECT to_char(o."placedAt" + ${LOCAL}, 'YYYY') AS year,
             SUM(oi."lineTotalMinor" - oi."taxMinor" - oi."unitCostMinor" * oi.quantity) FILTER (WHERE oi."unitCostMinor" IS NOT NULL) AS profit
      FROM order_items oi JOIN orders o ON o.id = oi."orderId"
      WHERE o."businessId" = ${actor.businessId} AND o.status::text <> ALL(${NON_REVENUE}) GROUP BY 1) p ON p.year = y.year
    ORDER BY y.year DESC LIMIT 5`;
  return rows.reverse().map((r) => ({ year: r.year, revenueMinor: n(r.revenue), grossProfitMinor: n(r.profit) }));
}

export const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  FACEBOOK_MANUAL: "Facebook",
  PHONE: "Phone",
  POS: "POS",
  WHOLESALE: "Wholesale",
  OTHER: "Other",
};

export async function getOrdersByChannel(actor: StaffActor, range: RangeKey) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const groups = await db.order.groupBy({
    by: ["source"],
    where: { businessId: actor.businessId, status: { notIn: [...NON_REVENUE_STATUSES] }, placedAt: { ...(period.start ? { gte: period.start } : {}), lt: period.end } },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((g) => [g.source, g._count._all]));
  // POS and wholesale are Release 2 channels: listed only once they have orders.
  return Object.keys(SOURCE_LABEL)
    .map((source) => ({ source, label: SOURCE_LABEL[source]!, orders: counts.get(source as never) ?? 0 }))
    .filter((c) => !["POS", "WHOLESALE"].includes(c.source) || c.orders > 0);
}

export async function getOrderStatusSummary(actor: StaffActor, range: RangeKey) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const groups = await db.order.groupBy({
    by: ["status"],
    where: { businessId: actor.businessId, status: { not: "DRAFT" }, placedAt: { ...(period.start ? { gte: period.start } : {}), lt: period.end } },
    _count: { _all: true },
  });
  let open = 0;
  let delivered = 0;
  let closed = 0;
  let awaiting = 0;
  for (const g of groups) {
    if (g.status === "DELIVERED") delivered += g._count._all;
    else if ((OPEN_STATUSES as readonly string[]).includes(g.status)) open += g._count._all;
    else closed += g._count._all;
    if (g.status === "PENDING_CONFIRMATION") awaiting += g._count._all;
  }
  return { total: open + delivered + closed, open, delivered, closed, awaiting };
}

export async function getCatalogCounts(actor: StaffActor) {
  assertCan(actor, "reports.view");
  const businessId = actor.businessId;
  const [products, categories, brands, suppliers, topSuppliers, stock] = await Promise.all([
    db.product.groupBy({ by: ["status"], where: { businessId }, _count: { _all: true } }),
    db.category.findMany({ where: { businessId }, select: { parentId: true } }),
    db.brand.groupBy({ by: ["status"], where: { businessId }, _count: { _all: true } }),
    db.supplier.groupBy({ by: ["isActive"], where: { businessId }, _count: { _all: true } }),
    db.$queryRaw<{ id: string; name: string; orders: bigint }[]>`
      SELECT s.id, s.name, COUNT(po.id) AS orders FROM suppliers s
      JOIN purchase_orders po ON po."supplierId" = s.id AND po.status <> 'CANCELLED'
      WHERE s."businessId" = ${businessId} GROUP BY s.id, s.name ORDER BY orders DESC, s.name LIMIT 5`,
    db.$queryRaw<{ out: bigint; low: bigint }[]>`
      SELECT COUNT(*) FILTER (WHERE available <= 0) AS out,
             COUNT(*) FILTER (WHERE available > 0 AND available <= threshold) AS low
      FROM (
        SELECT v.id, COALESCE(SUM(b."onHand" - b.reserved), 0) AS available,
               COALESCE(v."lowStockThreshold", bs."lowStockThreshold") AS threshold
        FROM product_variants v
        JOIN products p ON p.id = v."productId" AND p.status <> 'ARCHIVED'
        JOIN business_settings bs ON bs."businessId" = v."businessId"
        LEFT JOIN stock_balances b ON b."variantId" = v.id
        WHERE v."businessId" = ${businessId} AND v."isActive" AND v."trackInventory"
        GROUP BY v.id, v."lowStockThreshold", bs."lowStockThreshold") s`,
  ]);
  const productCount = (s: string) => products.find((p) => p.status === s)?._count._all ?? 0;
  const brandCount = (s: string) => brands.find((b) => b.status === s)?._count._all ?? 0;
  const supplierCount = (active: boolean) => suppliers.find((s) => s.isActive === active)?._count._all ?? 0;
  return {
    products: { total: productCount("ACTIVE") + productCount("DRAFT"), active: productCount("ACTIVE"), draft: productCount("DRAFT") },
    categories: { total: categories.length, topLevel: categories.filter((c) => !c.parentId).length, sub: categories.filter((c) => c.parentId).length },
    brands: { total: brandCount("ACTIVE") + brandCount("HIDDEN"), active: brandCount("ACTIVE"), hidden: brandCount("HIDDEN") },
    suppliers: {
      total: supplierCount(true) + supplierCount(false),
      active: supplierCount(true),
      inactive: supplierCount(false),
      top: topSuppliers.map((s) => ({ id: s.id, name: s.name, purchaseOrders: n(s.orders) })),
    },
    stock: { outOfStock: n(stock[0]?.out), lowStock: n(stock[0]?.low) },
  };
}

export async function getTopCategories(actor: StaffActor, range: RangeKey, limit = 6) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const rows = await db.$queryRaw<{ name: string; units: bigint; revenue: bigint }[]>`
    SELECT c.name, SUM(oi.quantity) AS units, SUM(oi."lineTotalMinor") AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    JOIN products p ON p.id = oi."productId"
    JOIN categories c ON c.id = p."primaryCategoryId"
    WHERE o."businessId" = ${actor.businessId} AND o.status::text <> ALL(${NON_REVENUE}) ${within('o."placedAt"', period.start, period.end)}
    GROUP BY c.id, c.name ORDER BY units DESC, revenue DESC LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, units: n(r.units), revenueMinor: n(r.revenue) }));
}

export async function getTopProducts(actor: StaffActor, range: RangeKey, limit = 5) {
  assertCan(actor, "reports.view");
  const period = periodFor(range);
  const rows = await db.$queryRaw<{ productId: string | null; title: string; units: bigint; revenue: bigint; imageKey: string | null }[]>`
    SELECT oi."productId", MAX(oi."productTitle") AS title, SUM(oi.quantity) AS units, SUM(oi."lineTotalMinor") AS revenue,
           (SELECT m."storageKey" FROM product_media m WHERE m."productId" = oi."productId" ORDER BY m."sortOrder" LIMIT 1) AS "imageKey"
    FROM order_items oi JOIN orders o ON o.id = oi."orderId"
    WHERE o."businessId" = ${actor.businessId} AND o.status::text <> ALL(${NON_REVENUE}) ${within('o."placedAt"', period.start, period.end)}
    GROUP BY oi."productId" ORDER BY units DESC, revenue DESC LIMIT ${limit}`;
  return rows.map((r) => ({ productId: r.productId, title: r.title, units: n(r.units), revenueMinor: n(r.revenue), imageUrl: r.imageKey ? mediaUrl(r.imageKey) : null }));
}
