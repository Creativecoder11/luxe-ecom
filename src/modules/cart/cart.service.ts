import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { DomainError, ValidationError } from "@/lib/errors";
import { RETAIL_PRICE_LIST } from "@/modules/catalog/defaults";
import { couponRule, CouponError, findUsableCoupon, normalizeCouponCode } from "@/modules/checkout/coupon.service";
import { priceOrder, type PricingResult, type ZoneRule } from "@/modules/checkout/pricing";
import { getAvailability } from "@/modules/inventory/ledger";
import { getCommerceSettings } from "@/modules/settings/commerce.service";

type Client = PrismaClient | Prisma.TransactionClient;

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = 50;

export function newCartToken(): string {
  return randomBytes(24).toString("base64url");
}

export class CartError extends DomainError {
  constructor(message: string) {
    super(message, "CART");
  }
}

/** A variant can be bought when it is active, its product is published and it has a retail price. */
async function purchasableVariant(client: Client, businessId: string, variantId: string) {
  const variant = await client.productVariant.findFirst({
    where: { id: variantId, businessId, isActive: true, product: { status: "ACTIVE" }, prices: { some: { priceList: { code: RETAIL_PRICE_LIST } } } },
    select: { id: true, title: true, product: { select: { title: true } } },
  });
  if (!variant) throw new CartError("This item is no longer available.");
  return variant;
}

export async function getOrCreateCart(businessId: string, token: string | null, userId: string | null) {
  if (token) {
    const existing = await db.cart.findUnique({ where: { token } });
    if (existing && existing.businessId === businessId) {
      if (userId && existing.userId !== userId) await db.cart.update({ where: { id: existing.id }, data: { userId } });
      return existing;
    }
  }
  return db.cart.create({ data: { businessId, token: newCartToken(), userId } });
}

/** Sets a line's quantity (0 removes it). Quantities are capped by available stock for tracked variants. */
export async function setCartQuantity(businessId: string, cartId: string, variantId: string, quantity: number, mode: "add" | "set") {
  if (!Number.isInteger(quantity) || quantity < 0) throw new ValidationError("Enter a valid quantity.");
  const current = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const target = mode === "add" ? (current?.quantity ?? 0) + quantity : quantity;
  if (target === 0) {
    if (current) await db.cartItem.delete({ where: { cartId_variantId: { cartId, variantId } } });
    return;
  }
  const variant = await purchasableVariant(db, businessId, variantId);
  if (target > MAX_LINE_QUANTITY) throw new CartError(`You can order at most ${MAX_LINE_QUANTITY} of one item.`);
  const availability = (await getAvailability(db, businessId, [variantId])).get(variantId);
  if (availability && availability.trackInventory && target > availability.available) {
    throw new CartError(
      availability.available <= 0
        ? `${variant.product.title} is out of stock.`
        : `Only ${availability.available} of ${variant.product.title} ${availability.available === 1 ? "is" : "are"} available.`,
    );
  }
  if (!current && (await db.cartItem.count({ where: { cartId } })) >= MAX_CART_LINES) throw new CartError("Your cart is full.");
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity: target },
    update: { quantity: target },
  });
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
}

export async function applyCartCoupon(businessId: string, cartId: string, code: string) {
  const coupon = await findUsableCoupon(db, businessId, code);
  await db.cart.update({ where: { id: cartId }, data: { couponCode: coupon.code } });
  return coupon;
}

export async function removeCartCoupon(cartId: string) {
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
}

/** Moves a guest cart's items into the signed-in user's cart (quantities summed, capped). */
export async function mergeCartsForUser(businessId: string, token: string, userId: string) {
  const guest = await db.cart.findUnique({ where: { token }, include: { items: true } });
  if (!guest || guest.businessId !== businessId) return;
  const others = await db.cart.findMany({ where: { businessId, userId, id: { not: guest.id } }, include: { items: true }, orderBy: { updatedAt: "desc" } });
  await db.$transaction(async (tx) => {
    for (const other of others) {
      for (const item of other.items) {
        const existing = guest.items.find((i) => i.variantId === item.variantId);
        const quantity = Math.min(MAX_LINE_QUANTITY, (existing?.quantity ?? 0) + item.quantity);
        await tx.cartItem.upsert({
          where: { cartId_variantId: { cartId: guest.id, variantId: item.variantId } },
          create: { cartId: guest.id, variantId: item.variantId, quantity },
          update: { quantity },
        });
      }
      await tx.cart.delete({ where: { id: other.id } });
    }
    await tx.cart.update({ where: { id: guest.id }, data: { userId } });
  });
}

export interface CartLineView {
  variantId: string;
  productId: string;
  slug: string;
  productTitle: string;
  variantTitle: string | null;
  sku: string;
  imageKey: string | null;
  unitPriceMinor: number;
  compareAtMinor: number | null;
  quantity: number;
  lineTotalMinor: number;
  taxRateBasisPoints: number;
  weightGrams: number | null;
  unitCostMinor: number | null;
  options: Record<string, string>;
  /** Units purchasable now (null when stock is not tracked). */
  available: number | null;
  problem: "unavailable" | "insufficient_stock" | null;
}

export interface CartView {
  cartId: string | null;
  lines: CartLineView[];
  couponCode: string | null;
  couponError: string | null;
  pricing: PricingResult;
  pricesIncludeTax: boolean;
  /** Owner's global COD switch (zones may still disable it per district). */
  codEnabled: boolean;
  hasProblems: boolean;
  itemCount: number;
}

/**
 * Priced view of a cart, always recomputed from the catalog (never stored prices).
 * Lines whose product was unpublished or that exceed stock are flagged, not silently changed.
 */
export async function getCartView(
  client: Client,
  businessId: string,
  token: string | null,
  options: { zone?: ZoneRule | null; paymentMethod?: "COD" | null; customerId?: string | null } = {},
): Promise<CartView> {
  const settings = await getCommerceSettings(client, businessId);
  const cart = token
    ? await client.cart.findUnique({
        where: { token },
        include: {
          items: {
            orderBy: { addedAt: "asc" },
            include: {
              variant: {
                include: {
                  prices: { where: { priceList: { code: RETAIL_PRICE_LIST } } },
                  options: { include: { attribute: { select: { label: true } }, option: { select: { label: true } } } },
                  product: {
                    select: {
                      id: true,
                      slug: true,
                      title: true,
                      status: true,
                      productType: true,
                      taxClass: { select: { rateBasisPoints: true } },
                      media: { orderBy: { sortOrder: "asc" }, take: 1, select: { storageKey: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;
  const items = cart && cart.businessId === businessId ? cart.items : [];
  const defaultTax = await client.taxClass.findFirst({ where: { businessId, isDefault: true }, select: { rateBasisPoints: true } });
  const availability = await getAvailability(client, businessId, items.map((i) => i.variantId));

  const lines: CartLineView[] = items.map((item) => {
    const v = item.variant;
    const price = v.prices[0];
    const sellable = v.isActive && v.product.status === "ACTIVE" && !!price;
    const stock = availability.get(v.id);
    const available = stock && stock.trackInventory ? Math.max(0, stock.available) : null;
    const unitPriceMinor = price?.amountMinor ?? 0;
    return {
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      productTitle: v.product.title,
      variantTitle: v.product.productType === "SIMPLE" ? null : v.title,
      sku: v.sku,
      imageKey: v.product.media[0]?.storageKey ?? null,
      unitPriceMinor,
      compareAtMinor: price?.compareAtMinor ?? null,
      quantity: item.quantity,
      lineTotalMinor: unitPriceMinor * item.quantity,
      taxRateBasisPoints: v.product.taxClass?.rateBasisPoints ?? defaultTax?.rateBasisPoints ?? 0,
      weightGrams: v.weightGrams,
      unitCostMinor: v.costMinor,
      options: Object.fromEntries(v.options.map((o) => [o.attribute.label, o.option.label])),
      available,
      problem: !sellable ? "unavailable" : available !== null && item.quantity > available ? "insufficient_stock" : null,
    };
  });

  let couponError: string | null = null;
  let rule = null;
  if (cart?.couponCode) {
    try {
      rule = couponRule(await findUsableCoupon(client, businessId, cart.couponCode, options.customerId));
    } catch (error) {
      if (!(error instanceof CouponError)) throw error;
      couponError = error.message;
    }
  }
  const priced = lines.filter((l) => l.problem !== "unavailable");
  const pricing = priceOrder({
    lines: priced.map((l) => ({ key: l.variantId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, taxRateBasisPoints: l.taxRateBasisPoints, weightGrams: l.weightGrams })),
    pricesIncludeTax: settings.pricesIncludeTax,
    coupon: rule,
    zone: options.zone ?? null,
    paymentMethod: options.paymentMethod ?? null,
  });
  if (rule && pricing.couponNote === "minimum_subtotal") couponError = "Add more items to use this coupon (minimum order not reached).";

  return {
    cartId: cart?.id ?? null,
    lines,
    couponCode: cart?.couponCode ? normalizeCouponCode(cart.couponCode) : null,
    couponError,
    pricing,
    pricesIncludeTax: settings.pricesIncludeTax,
    codEnabled: settings.codEnabled,
    hasProblems: lines.some((l) => l.problem !== null),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  };
}

/** Total units in a cart (header badge). */
export async function getCartItemCount(businessId: string, token: string): Promise<number> {
  const cart = await db.cart.findUnique({ where: { token }, select: { businessId: true, items: { select: { quantity: true } } } });
  if (!cart || cart.businessId !== businessId) return 0;
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}

/** Cart view for pages (uses the shared client). */
export function loadCartView(businessId: string, token: string | null, options: Parameters<typeof getCartView>[3] = {}) {
  return getCartView(db, businessId, token, options);
}
