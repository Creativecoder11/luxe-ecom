import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db/client";
import { getBusinessId } from "@/modules/business/context";
import { CATALOG_TAG } from "@/modules/catalog/storefront";
import { NON_REVENUE_STATUSES } from "@/modules/reports/definitions";

/** Expired by order placement and coupon changes. */
export const STOREFRONT_STATS_TAG = "storefront-stats";

/** Product ids ranked by units sold in the last 90 days (real orders only; empty when nothing has sold). */
export async function getBestSellerIds(limit = 6): Promise<string[]> {
  "use cache";
  cacheTag(CATALOG_TAG, STOREFRONT_STATS_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const rows = await db.$queryRaw<{ productId: string }[]>`
    SELECT oi."productId"
    FROM order_items oi JOIN orders o ON o.id = oi."orderId"
    WHERE o."businessId" = ${businessId}
      AND o.status::text <> ALL(${[...NON_REVENUE_STATUSES]})
      AND o."placedAt" > now() - interval '90 days'
      AND oi."productId" IS NOT NULL
    GROUP BY oi."productId"
    ORDER BY SUM(oi.quantity) DESC, oi."productId"
    LIMIT ${limit}`;
  return rows.map((r) => r.productId);
}

export interface StoreStats {
  /** Distinct customers with at least one delivered order. */
  customersServed: number;
  /** Published products with a price. */
  productsAvailable: number;
  /** Customers with 2+ sales orders ÷ customers with 1+, as a percentage (null without customers). */
  repeatCustomerPercent: number | null;
}

export async function getStoreStats(): Promise<StoreStats> {
  "use cache";
  cacheTag(CATALOG_TAG, STOREFRONT_STATS_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const [served, products, repeat] = await Promise.all([
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT "customerId") AS n FROM orders WHERE "businessId" = ${businessId} AND status = 'DELIVERED'`,
    db.product.count({ where: { businessId, status: "ACTIVE", priceFromMinor: { not: null } } }),
    db.$queryRaw<{ buyers: bigint; repeaters: bigint }[]>`
      SELECT COUNT(*) AS buyers, COUNT(*) FILTER (WHERE n >= 2) AS repeaters FROM (
        SELECT "customerId", COUNT(*) AS n FROM orders
        WHERE "businessId" = ${businessId} AND status::text <> ALL(${[...NON_REVENUE_STATUSES]})
        GROUP BY "customerId") t`,
  ]);
  const buyers = Number(repeat[0]?.buyers ?? 0);
  const repeaters = Number(repeat[0]?.repeaters ?? 0);
  return {
    customersServed: Number(served[0]?.n ?? 0),
    productsAvailable: products,
    repeatCustomerPercent: buyers ? Math.round((repeaters / buyers) * 100) : null,
  };
}

export interface SaleCampaign {
  code: string;
  endsAt: string;
  /** Discount as configured on the coupon: "10%" or "৳500" (formatted by the caller). */
  percent: number | null;
  amountMinor: number | null;
  freeShipping: boolean;
}

/** The coupon behind the homepage countdown, only while it is active and has a future end date. */
export async function getSaleCampaign(code: string): Promise<SaleCampaign | null> {
  "use cache";
  cacheTag(STOREFRONT_STATS_TAG);
  cacheLife("minutes");
  if (!code) return null;
  const businessId = await getBusinessId();
  const now = new Date();
  const coupon = await db.coupon.findFirst({
    where: {
      businessId,
      code,
      isActive: true,
      endsAt: { gt: now },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
    },
    select: { code: true, endsAt: true, type: true, percentBasisPoints: true, amountMinor: true, usageLimit: true, timesUsed: true },
  });
  if (!coupon?.endsAt) return null;
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) return null;
  return {
    code: coupon.code,
    endsAt: coupon.endsAt.toISOString(),
    percent: coupon.percentBasisPoints !== null ? coupon.percentBasisPoints / 100 : null,
    amountMinor: coupon.amountMinor,
    freeShipping: coupon.type === "FREE_SHIPPING",
  };
}

/** Expired whenever delivery or COD settings change. */
export const STORE_POLICY_TAG = "store-policy";

export interface PublicDeliveryInfo {
  codEnabled: boolean;
  codMaxOrderMinor: number | null;
  zones: {
    name: string;
    districts: string[];
    isFallback: boolean;
    baseFeeMinor: number;
    includedWeightGrams: number;
    extraPerKgMinor: number;
    freeShippingThresholdMinor: number | null;
    codEnabled: boolean;
    codFeeMinor: number;
    estimate: string | null;
  }[];
}

/** Delivery zones, fees and COD rules exactly as configured in Settings (shipping page, footer). */
export async function getPublicDeliveryInfo(): Promise<PublicDeliveryInfo> {
  "use cache";
  cacheTag(STORE_POLICY_TAG);
  cacheLife("hours");
  const businessId = await getBusinessId();
  const [settings, zones] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId }, select: { codEnabled: true, codMaxOrderMinor: true } }),
    db.shippingZone.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ isFallback: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        districts: true,
        isFallback: true,
        baseFeeMinor: true,
        includedWeightGrams: true,
        extraPerKgMinor: true,
        freeShippingThresholdMinor: true,
        codEnabled: true,
        codFeeMinor: true,
        estimate: true,
      },
    }),
  ]);
  return { codEnabled: settings?.codEnabled ?? false, codMaxOrderMinor: settings?.codMaxOrderMinor ?? null, zones };
}
