import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { findDistrict } from "@/lib/bd-geo";
import { db, HEAVY_TRANSACTION } from "@/lib/db/client";
import { nextSequenceValue } from "@/lib/db/sequence";
import { ValidationError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { normalizeBdMobile } from "@/lib/phone";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getCartView } from "@/modules/cart/cart.service";
import { resolveOrderCustomer } from "@/modules/customers/customer.service";
import { applyMovement, getDefaultWarehouseId, InsufficientStockError } from "@/modules/inventory/ledger";
import { getCommerceSettings, resolveZone } from "@/modules/settings/commerce.service";
import { CouponError, findUsableCoupon } from "./coupon.service";

/** A checkout problem the customer can fix; field errors (district, payment) reach the form. */
export class CheckoutError extends ValidationError {}

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(120),
  phone: z.string().trim().min(1, "Enter a mobile number"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().default(""),
  district: z.string().min(1, "Choose a district"),
  upazila: z.string().trim().min(2, "Enter the upazila / thana").max(80),
  area: z.string().trim().max(120).optional().default(""),
  addressLine: z.string().trim().min(5, "Enter the house, road and area").max(300),
  note: z.string().trim().max(500).optional().default(""),
  paymentMethod: z.literal("COD", { message: "Choose a payment method" }),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Please reload the page and try again"),
});

export interface PlacedOrder {
  publicToken: string;
  number: string;
  existing: boolean;
}

/** "ORD-261012-0007": date in business time (Asia/Dhaka) + per-day sequence. */
function orderDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}${get("month")}${get("day")}`;
}

/**
 * Places a Cash on Delivery order from a cart. Everything is recomputed server-side; the order,
 * its snapshots, stock reservations, coupon redemption, payment record, status history and the
 * "order.placed" outbox event commit atomically. Re-submitting the same idempotency key returns
 * the existing order instead of creating a duplicate.
 */
export async function placeOrder(context: { businessId: string; cartToken: string | null; userId: string | null }, raw: unknown): Promise<PlacedOrder> {
  const input = checkoutSchema.parse(raw);
  const { businessId } = context;

  const previous = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { publicToken: true, number: true, businessId: true } });
  if (previous && previous.businessId === businessId) return { publicToken: previous.publicToken, number: previous.number, existing: true };

  const phone = normalizeBdMobile(input.phone);
  if (!phone.ok) throw new ValidationError("Enter a valid Bangladesh mobile number.", { phone: "Enter a valid Bangladesh mobile number, e.g. 01712345678" });
  const district = findDistrict(input.district);
  if (!district) throw new ValidationError("Choose a district.", { district: "Choose a district" });

  const settings = await getCommerceSettings(db, businessId);
  if (!context.userId && !settings.guestCheckoutEnabled) throw new CheckoutError("Please sign in to place an order.");
  const zone = await resolveZone(db, businessId, district.code);
  if (!zone) throw new CheckoutError(`Sorry, we do not deliver to ${district.name} yet.`, { district: "Delivery is not available here" });
  if (!settings.codEnabled || !zone.codEnabled) throw new CheckoutError(`Cash on Delivery is not available in ${district.name}.`, { paymentMethod: "Not available for this district" });

  const view = await getCartView(db, businessId, context.cartToken, { zone, paymentMethod: "COD" });
  if (!view.cartId || view.lines.length === 0) throw new CheckoutError("Your cart is empty.");
  if (view.hasProblems) throw new CheckoutError("Some items in your cart changed. Review your cart and try again.");
  if (view.couponError) throw new CheckoutError(view.couponError);
  const pricing = view.pricing;
  if (settings.codMaxOrderMinor !== null && pricing.totalMinor > settings.codMaxOrderMinor) {
    throw new CheckoutError(`Cash on Delivery is available for orders up to ${formatMoney(settings.codMaxOrderMinor)}.`);
  }

  const warehouseId = await getDefaultWarehouseId(db, businessId);
  const publicToken = randomBytes(24).toString("base64url");
  const shippingAddress = {
    recipientName: input.name,
    phone: phone.e164,
    division: district.division,
    district: district.code,
    districtName: district.name,
    upazila: input.upazila,
    area: input.area || null,
    addressLine: input.addressLine,
  };

  try {
    return await db.$transaction(async (tx) => {
      const customer = await resolveOrderCustomer(tx, businessId, { name: input.name, phoneE164: phone.e164, email: input.email || null, userId: context.userId });

      let coupon = null;
      if (view.couponCode && pricing.couponApplied) {
        coupon = await findUsableCoupon(tx, businessId, view.couponCode, customer.id);
        // Guarded increment: concurrent checkouts cannot exceed the usage limit.
        const claimed = await tx.$executeRaw`
          UPDATE "coupons" SET "timesUsed" = "timesUsed" + 1, "updatedAt" = now()
          WHERE "id" = ${coupon.id} AND ("usageLimit" IS NULL OR "timesUsed" < "usageLimit")`;
        if (claimed === 0) throw new CouponError("This coupon has just been fully redeemed.");
      }

      const dateKey = orderDateKey();
      const number = `ORD-${dateKey}-${String(await nextSequenceValue(tx, businessId, `ORDER:${dateKey}`)).padStart(4, "0")}`;
      const priced = new Map(pricing.lines.map((l) => [l.key, l]));
      const order = await tx.order.create({
        data: {
          businessId,
          number,
          publicToken,
          source: "WEBSITE",
          status: "PENDING_CONFIRMATION",
          paymentMethod: "COD",
          paymentStatus: "COD_UNPAID",
          customerId: customer.id,
          contactName: input.name,
          contactPhoneE164: phone.e164,
          contactEmail: input.email || null,
          shippingAddress,
          shippingZoneName: zone.name,
          subtotalMinor: pricing.subtotalMinor,
          discountMinor: pricing.discountMinor,
          shippingMinor: pricing.shippingMinor ?? 0,
          codFeeMinor: pricing.codFeeMinor,
          taxMinor: pricing.taxMinor,
          pricesIncludeTax: pricing.pricesIncludeTax,
          totalMinor: pricing.totalMinor,
          couponCode: coupon?.code ?? null,
          customerNote: input.note || null,
          idempotencyKey: input.idempotencyKey,
          placedByUserId: context.userId,
          items: {
            create: view.lines.map((line) => {
              const p = priced.get(line.variantId)!;
              return {
                variantId: line.variantId,
                productId: line.productId,
                productTitle: line.productTitle,
                variantTitle: line.variantTitle ?? "",
                sku: line.sku,
                options: line.options,
                unitPriceMinor: line.unitPriceMinor,
                quantity: line.quantity,
                discountMinor: p.discountMinor,
                taxRateBasisPoints: line.taxRateBasisPoints,
                taxMinor: p.taxMinor,
                lineTotalMinor: p.lineTotalMinor,
                unitCostMinor: line.unitCostMinor,
              };
            }),
          },
          payments: { create: { method: "COD", status: "COD_UNPAID", amountMinor: pricing.totalMinor } },
          history: { create: { toStatus: "PENDING_CONFIRMATION", actorType: context.userId ? "CUSTOMER" : "SYSTEM", actorId: context.userId, note: "Placed on the website" } },
        },
      });

      // Reserve stock for every tracked line; collect all shortages before failing.
      const short: string[] = [];
      for (const line of view.lines) {
        if (line.available === null) continue;
        try {
          await applyMovement(tx, {
            businessId,
            warehouseId,
            variantId: line.variantId,
            type: "RESERVE",
            onHandDelta: 0,
            reservedDelta: line.quantity,
            sourceType: "Order",
            sourceId: order.id,
            actor: { type: context.userId ? "CUSTOMER" : "SYSTEM", id: context.userId },
          });
          await tx.stockReservation.create({ data: { orderId: order.id, variantId: line.variantId, warehouseId, quantity: line.quantity } });
        } catch (error) {
          if (error instanceof InsufficientStockError) short.push(line.variantTitle ? `${line.productTitle} (${line.variantTitle})` : line.productTitle);
          else throw error;
        }
      }
      if (short.length) throw new CheckoutError(`Sorry, these items just sold out or have fewer units left: ${short.join(", ")}. Please update your cart.`);

      if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, orderId: order.id, customerId: customer.id, discountMinor: pricing.discountMinor } });
      await tx.outboxEvent.create({
        data: { businessId, type: "order.placed", payload: { orderId: order.id, number }, idempotencyKey: `order.placed:${order.id}` },
      });
      await tx.cartItem.deleteMany({ where: { cartId: view.cartId! } });
      await tx.cart.update({ where: { id: view.cartId! }, data: { couponCode: null } });
      return { publicToken, number, existing: false };
    }, HEAVY_TRANSACTION);
  } catch (error) {
    // A concurrent double submit with the same key: return the order that won.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { publicToken: true, number: true } });
      if (winner) return { ...winner, existing: true };
    }
    throw error;
  }
}

/** Order summary for the confirmation page, looked up by its unguessable token. */
export async function getOrderByPublicToken(businessId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.order.findFirst({
    where: { businessId, publicToken: token },
    include: { items: { orderBy: { id: "asc" } } },
  });
}

/** Orders the signed-in customer placed themselves (never matched by phone; see customer.service). */
export async function listOrdersForUser(businessId: string, userId: string) {
  return db.order.findMany({
    where: { businessId, OR: [{ placedByUserId: userId }, { customer: { userId } }] },
    orderBy: { placedAt: "desc" },
    take: 100,
    include: { items: { select: { quantity: true } } },
  });
}

export async function getOrderForUser(businessId: string, userId: string, number: string) {
  return db.order.findFirst({
    where: { businessId, number, OR: [{ placedByUserId: userId }, { customer: { userId } }] },
    include: { items: { orderBy: { id: "asc" } }, history: { orderBy: { createdAt: "asc" } } },
  });
}

export interface CheckoutQuote {
  deliverable: boolean;
  codAvailable: boolean;
  zoneName: string | null;
  estimate: string | null;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  pricesIncludeTax: boolean;
  totalMinor: number;
  message: string | null;
}

/** Live delivery/COD quote for a district, computed exactly as placeOrder will compute it. */
export async function quoteCheckout(businessId: string, cartToken: string | null, districtCode: string): Promise<CheckoutQuote> {
  const settings = await getCommerceSettings(db, businessId);
  const district = findDistrict(districtCode);
  const zone = district ? await resolveZone(db, businessId, district.code) : null;
  const view = await getCartView(db, businessId, cartToken, { zone, paymentMethod: zone ? "COD" : null });
  const p = view.pricing;
  const codAvailable = !!zone && settings.codEnabled && zone.codEnabled && (settings.codMaxOrderMinor === null || p.totalMinor <= settings.codMaxOrderMinor);
  return {
    deliverable: !!zone,
    codAvailable,
    zoneName: zone?.name ?? null,
    estimate: zone?.estimate ?? null,
    subtotalMinor: p.subtotalMinor,
    discountMinor: p.discountMinor,
    shippingMinor: p.shippingMinor ?? 0,
    codFeeMinor: p.codFeeMinor,
    taxMinor: p.taxMinor,
    pricesIncludeTax: p.pricesIncludeTax,
    totalMinor: p.totalMinor,
    message: !district
      ? null
      : !zone
        ? `Sorry, we do not deliver to ${district.name} yet.`
        : !codAvailable
          ? settings.codMaxOrderMinor !== null && p.totalMinor > settings.codMaxOrderMinor
            ? `Cash on Delivery is available for orders up to ${formatMoney(settings.codMaxOrderMinor)}.`
            : `Cash on Delivery is not available in ${district.name}.`
          : null,
  };
}

/** Last delivery details the signed-in customer used (to prefill checkout). */
export async function getLastShippingDetails(businessId: string, userId: string) {
  const last = await db.order.findFirst({
    where: { businessId, placedByUserId: userId },
    orderBy: { placedAt: "desc" },
    select: { contactName: true, contactPhoneE164: true, contactEmail: true, shippingAddress: true },
  });
  if (!last) return null;
  const a = last.shippingAddress as { district?: string; upazila?: string; area?: string | null; addressLine?: string };
  return { name: last.contactName, phone: last.contactPhoneE164, email: last.contactEmail ?? "", district: a.district ?? "", upazila: a.upazila ?? "", area: a.area ?? "", addressLine: a.addressLine ?? "" };
}

/** Per-IP throttle for order placement (spam/abuse protection). */
export async function consumeCheckoutRateLimit(ip: string) {
  await consumeRateLimit(db, RATE_LIMITS.checkoutByIp, ip);
}
