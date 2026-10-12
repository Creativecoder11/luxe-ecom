import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { getCartView, getOrCreateCart, setCartQuantity, applyCartCoupon, CartError } from "@/modules/cart/cart.service";
import { placeOrder, CheckoutError, listOrdersForUser } from "@/modules/checkout/checkout.service";
import { saveCoupon } from "@/modules/checkout/coupon.service";
import type { StaffActor } from "@/modules/identity/actor";
import { adjustStock } from "@/modules/inventory/inventory.service";
import { getAvailability } from "@/modules/inventory/ledger";
import { createPurchaseOrder, placePurchaseOrder, receivePurchaseOrder, saveSupplier } from "@/modules/purchasing/purchasing.service";
import { saveShippingZone, saveTaxClass, updateCommerceSettings } from "@/modules/settings/commerce.service";
import { seedCatalog } from "../../prisma/fixtures/catalog";
import { createBusiness, createStaffActor, db, resetDatabase } from "../support/db";

let owner: StaffActor;
let businessId: string;

const variantBySku = async (sku: string) => db.productVariant.findFirstOrThrow({ where: { businessId, sku } });
const address = { name: "Ayesha Rahman", phone: "01812345678", email: "", district: "dhaka", upazila: "Gulshan", area: "Gulshan 1", addressLine: "House 1, Road 2", note: "", paymentMethod: "COD" as const };

async function cartWith(lines: [string, number][]) {
  const cart = await getOrCreateCart(businessId, null, null);
  for (const [sku, qty] of lines) await setCartQuantity(businessId, cart.id, (await variantBySku(sku)).id, qty, "set");
  return cart.token;
}

const order = (cartToken: string, overrides: Partial<typeof address> = {}, userId: string | null = null) =>
  placeOrder({ businessId, cartToken, userId }, { ...address, ...overrides, idempotencyKey: randomUUID().replace(/-/g, "") });

beforeAll(async () => {
  await resetDatabase();
  businessId = (await createBusiness()).id;
  owner = await createStaffActor(businessId, "owner");
  await seedCatalog(owner);
  await saveShippingZone(owner, null, { name: "Inside Dhaka", districts: ["dhaka"], baseFee: "60", includedWeightGrams: 1000, extraPerKg: "20", estimate: "1–2 days" });
  await saveShippingZone(owner, null, { name: "Rest of Bangladesh", isFallback: true, baseFee: "120", extraPerKg: "25", codFee: "10" });
  for (const sku of ["SER-HYDRA-30", "AUD-EARBUDS-PRO", "HOM-MUG-4"]) {
    await adjustStock(owner, { variantId: (await variantBySku(sku)).id, quantity: 20, reason: "OPENING_BALANCE" });
  }
});

describe("stock ledger", () => {
  it("records every change with running balances and refuses negative stock", async () => {
    const mug = await variantBySku("HOM-MUG-4");
    await adjustStock(owner, { variantId: mug.id, quantity: -2, reason: "DAMAGED", note: "Broken in transit" });
    await expect(adjustStock(owner, { variantId: mug.id, quantity: -1000, reason: "COUNT_CORRECTION" })).rejects.toThrow(/Not enough stock/);
    const movements = await db.stockMovement.findMany({ where: { variantId: mug.id }, orderBy: { createdAt: "asc" } });
    expect(movements.map((m) => [m.type, m.onHandDelta, m.onHandAfter])).toEqual([["OPENING_BALANCE", 20, 20], ["DAMAGE", -2, 18]]);
    await expect(db.stockMovement.delete({ where: { id: movements[0]!.id } })).rejects.toThrow(/append-only/);
    await adjustStock(owner, { variantId: mug.id, quantity: 2, reason: "FOUND" });
  });

  it("validates reasons and permissions", async () => {
    const mug = await variantBySku("HOM-MUG-4");
    await expect(adjustStock(owner, { variantId: mug.id, quantity: 5, reason: "DAMAGED" })).rejects.toBeInstanceOf(Error);
    await expect(adjustStock(owner, { variantId: mug.id, quantity: 1, reason: "OTHER" })).rejects.toThrow();
    const crm = await createStaffActor(businessId, "crm_agent");
    await expect(adjustStock(crm, { variantId: mug.id, quantity: 1, reason: "FOUND" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("purchasing", () => {
  it("receives goods in parts, updates stock and the moving-average cost", async () => {
    const tee = await variantBySku("TEE-CREW-M-BLACK");
    const supplier = await saveSupplier(owner, null, { name: "Dhaka Garments Ltd", phone: "01711000000" });
    const po = await createPurchaseOrder(owner, { supplierId: supplier.id, items: [{ variantId: tee.id, quantity: 10, unitCost: "300" }] });
    expect(po.number).toMatch(/^PO-\d{6}$/);
    const inventoryOperator = await createStaffActor(businessId, "inventory_operator");
    await expect(placePurchaseOrder(inventoryOperator, po.id)).rejects.toBeInstanceOf(ForbiddenError);
    await placePurchaseOrder(owner, po.id);
    const item = await db.purchaseOrderItem.findFirstOrThrow({ where: { purchaseOrderId: po.id } });

    await receivePurchaseOrder(owner, po.id, { lines: [{ itemId: item.id, quantity: 4 }] });
    expect((await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("PARTIALLY_RECEIVED");
    expect((await variantBySku("TEE-CREW-M-BLACK")).costMinor).toBe(30000); // no prior stock → receipt cost

    await expect(receivePurchaseOrder(owner, po.id, { lines: [{ itemId: item.id, quantity: 7 }] })).rejects.toBeInstanceOf(ValidationError);
    await receivePurchaseOrder(owner, po.id, { lines: [{ itemId: item.id, quantity: 6 }] });
    expect((await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("RECEIVED");
    expect((await getAvailability(db, businessId, [tee.id])).get(tee.id)?.onHand).toBe(10);
    expect(await db.goodsReceipt.count({ where: { purchaseOrderId: po.id } })).toBe(2);
    await expect(receivePurchaseOrder(owner, po.id, { lines: [{ itemId: item.id, quantity: 1 }] })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("cart", () => {
  it("recomputes prices from the catalog and caps quantities at available stock", async () => {
    const token = await cartWith([["SER-HYDRA-30", 2]]);
    const cart = await db.cart.findUniqueOrThrow({ where: { token } });
    await expect(setCartQuantity(businessId, cart.id, (await variantBySku("SER-HYDRA-30")).id, 500, "set")).rejects.toBeInstanceOf(CartError);
    await expect(setCartQuantity(businessId, cart.id, (await variantBySku("KRT-CLASSIC-S-NAVY")).id, 1, "add")).rejects.toThrow(/out of stock/);
    const view = await getCartView(db, businessId, token);
    expect(view.lines[0]).toMatchObject({ unitPriceMinor: 125_000, quantity: 2, lineTotalMinor: 250_000 });
    expect(view.pricing.subtotalMinor).toBe(250_000);
  });

  it("rejects draft products", async () => {
    const cart = await getOrCreateCart(businessId, null, null);
    await expect(setCartQuantity(businessId, cart.id, (await variantBySku("HOM-CUSHION")).id, 1, "add")).rejects.toThrow(/no longer available/);
  });
});

describe("checkout", () => {
  it("places a COD order with server-computed totals, snapshots and a stock reservation", async () => {
    const serum = await variantBySku("SER-HYDRA-30");
    const before = (await getAvailability(db, businessId, [serum.id])).get(serum.id)!;
    const token = await cartWith([["SER-HYDRA-30", 2]]);
    const placed = await order(token);
    const o = await db.order.findUniqueOrThrow({ where: { publicToken: placed.publicToken }, include: { items: true, payments: true, history: true, reservations: true } });
    expect(o.number).toMatch(/^ORD-\d{6}-\d{4}$/);
    expect(o).toMatchObject({ status: "PENDING_CONFIRMATION", paymentStatus: "COD_UNPAID", source: "WEBSITE", subtotalMinor: 250_000, shippingMinor: 6_000, codFeeMinor: 0, totalMinor: 256_000, shippingZoneName: "Inside Dhaka" });
    expect(o.items[0]).toMatchObject({ productTitle: "Hydrating Face Serum 30 ml", sku: "SER-HYDRA-30", unitPriceMinor: 125_000, quantity: 2, unitCostMinor: 52_000 });
    expect(o.payments[0]).toMatchObject({ method: "COD", status: "COD_UNPAID", amountMinor: 256_000 });
    expect(o.history[0]?.toStatus).toBe("PENDING_CONFIRMATION");
    expect(o.reservations[0]).toMatchObject({ quantity: 2, status: "ACTIVE" });
    const after = (await getAvailability(db, businessId, [serum.id])).get(serum.id)!;
    expect(after.reserved - before.reserved).toBe(2);
    expect(after.onHand).toBe(before.onHand);
    expect(await db.outboxEvent.count({ where: { idempotencyKey: `order.placed:${o.id}` } })).toBe(1);
    expect(await db.cartItem.count({ where: { cart: { token } } })).toBe(0);
  });

  it("charges the fallback zone and its COD fee outside Dhaka, by weight", async () => {
    const token = await cartWith([["AUD-EARBUDS-PRO", 1]]);
    const placed = await order(token, { district: "rajshahi", upazila: "Boalia" });
    const o = await db.order.findUniqueOrThrow({ where: { publicToken: placed.publicToken } });
    expect(o).toMatchObject({ shippingZoneName: "Rest of Bangladesh", shippingMinor: 12_000, codFeeMinor: 1_000, totalMinor: 349_900 + 12_000 + 1_000 });
  });

  it("is idempotent: the same key never creates a second order", async () => {
    const token = await cartWith([["HOM-MUG-4", 1]]);
    const key = randomUUID().replace(/-/g, "");
    const [a, b] = await Promise.all([
      placeOrder({ businessId, cartToken: token, userId: null }, { ...address, idempotencyKey: key }),
      placeOrder({ businessId, cartToken: token, userId: null }, { ...address, idempotencyKey: key }).catch((e: unknown) => e),
    ]);
    const orders = await db.order.count({ where: { idempotencyKey: key } });
    expect(orders).toBe(1);
    if (!(b instanceof Error)) expect(b).toMatchObject({ number: (a as { number: string }).number });
  });

  it("never oversells: 10 concurrent checkouts for 3 units produce exactly 3 orders", async () => {
    const band = await variantBySku("WRB-BAND-OLIVE");
    await adjustStock(owner, { variantId: band.id, quantity: 3, reason: "OPENING_BALANCE" });
    const tokens = await Promise.all(Array.from({ length: 10 }, () => cartWith([["WRB-BAND-OLIVE", 1]])));
    const results = await Promise.allSettled(tokens.map((t) => order(t)));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(3);
    for (const r of results.filter((x) => x.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(CheckoutError);
    }
    const stock = (await getAvailability(db, businessId, [band.id])).get(band.id)!;
    expect(stock).toMatchObject({ onHand: 3, reserved: 3, available: 0 });
  });

  it("enforces coupon usage limits under concurrency", async () => {
    await saveCoupon(owner, null, { code: "ONLYTWO", type: "FIXED", amount: "100", usageLimit: "2" });
    const tokens = await Promise.all(Array.from({ length: 5 }, () => cartWith([["SER-HYDRA-30", 1]])));
    for (const t of tokens) await applyCartCoupon(businessId, (await db.cart.findUniqueOrThrow({ where: { token: t } })).id, "onlytwo");
    const results = await Promise.allSettled(tokens.map((t) => order(t)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const coupon = await db.coupon.findFirstOrThrow({ where: { businessId, code: "ONLYTWO" } });
    expect(coupon.timesUsed).toBe(2);
    expect(await db.couponRedemption.count({ where: { couponId: coupon.id } })).toBe(2);
    const discounted = await db.order.findMany({ where: { couponCode: "ONLYTWO" } });
    expect(discounted.every((o) => o.discountMinor === 10_000)).toBe(true);
  });

  it("applies owner-configured VAT exclusive of prices", async () => {
    await saveTaxClass(owner, (await db.taxClass.findFirstOrThrow({ where: { businessId, isDefault: true } })).id, { name: "Standard VAT", code: "standard", ratePercent: "15", isDefault: true });
    await updateCommerceSettings(owner, { pricesIncludeTax: false, codEnabled: true, codMaxOrder: "", guestCheckoutEnabled: true, lowStockThreshold: "5" });
    const token = await cartWith([["HOM-MUG-4", 1]]);
    const placed = await order(token);
    const o = await db.order.findUniqueOrThrow({ where: { publicToken: placed.publicToken }, include: { items: true } });
    expect(o).toMatchObject({ subtotalMinor: 149_000, taxMinor: 22_350, pricesIncludeTax: false, totalMinor: 149_000 + 22_350 + 6_000 });
    expect(o.items[0]).toMatchObject({ taxRateBasisPoints: 1500, taxMinor: 22_350 });
    await updateCommerceSettings(owner, { pricesIncludeTax: true, codEnabled: true, codMaxOrder: "", guestCheckoutEnabled: true, lowStockThreshold: "5" });
  });

  it("refuses undeliverable districts, COD-disabled zones and orders above the COD limit", async () => {
    const zone = await db.shippingZone.findFirstOrThrow({ where: { businessId, isFallback: true } });
    await saveShippingZone(owner, zone.id, { name: "Rest of Bangladesh", isFallback: true, baseFee: "120", codEnabled: false });
    const token = await cartWith([["HOM-MUG-4", 1]]);
    await expect(order(token, { district: "sylhet", upazila: "Sylhet Sadar" })).rejects.toThrow(/Cash on Delivery is not available/);
    await saveShippingZone(owner, zone.id, { name: "Rest of Bangladesh", isFallback: true, baseFee: "120", isActive: false });
    await expect(order(token, { district: "sylhet", upazila: "Sylhet Sadar" })).rejects.toThrow(/do not deliver to Sylhet/);
    await saveShippingZone(owner, zone.id, { name: "Rest of Bangladesh", isFallback: true, baseFee: "120", extraPerKg: "25", codFee: "10" });

    await updateCommerceSettings(owner, { pricesIncludeTax: true, codEnabled: true, codMaxOrder: "1000", guestCheckoutEnabled: true, lowStockThreshold: "5" });
    await expect(order(token)).rejects.toThrow(/orders up to/);
    await updateCommerceSettings(owner, { pricesIncludeTax: true, codEnabled: true, codMaxOrder: "", guestCheckoutEnabled: true, lowStockThreshold: "5" });
  });

  it("ignores client-side tampering: totals come only from the catalog", async () => {
    const token = await cartWith([["HOM-MUG-4", 1]]);
    const placed = await placeOrder({ businessId, cartToken: token, userId: null }, { ...address, idempotencyKey: randomUUID().replace(/-/g, ""), totalMinor: 1, price: "1", unitPriceMinor: 1 });
    const o = await db.order.findUniqueOrThrow({ where: { publicToken: placed.publicToken } });
    expect(o.subtotalMinor).toBe(149_000);
  });

  it("dedups customers by phone but never links an account to someone else's guest orders", async () => {
    const before = await db.customer.count({ where: { businessId, phoneE164: "+8801812345678" } });
    expect(before).toBe(1);
    const user = await db.user.create({ data: { id: randomUUID(), name: "Impostor", email: `imp-${randomUUID()}@example.test`, kind: "CUSTOMER" } });
    expect(await listOrdersForUser(businessId, user.id)).toHaveLength(0);
    const token = await cartWith([["HOM-MUG-4", 1]]);
    await order(token, {}, user.id);
    const mine = await listOrdersForUser(businessId, user.id);
    expect(mine).toHaveLength(1);
  });

  it("rejects an empty cart and invalid phones", async () => {
    const empty = await getOrCreateCart(businessId, null, null);
    await expect(order(empty.token)).rejects.toThrow(/cart is empty/);
    const token = await cartWith([["HOM-MUG-4", 1]]);
    await expect(order(token, { phone: "12345" })).rejects.toBeInstanceOf(ValidationError);
  });
});

