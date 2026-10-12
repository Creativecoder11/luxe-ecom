import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { getOrCreateCart, setCartQuantity } from "@/modules/cart/cart.service";
import { placeOrder } from "@/modules/checkout/checkout.service";
import { saveCoupon } from "@/modules/checkout/coupon.service";
import { getHomepageContentForAdmin, subscribeToNewsletter, updateHomepageSection, uploadContentImage } from "@/modules/content/content.service";
import type { StaffActor } from "@/modules/identity/actor";
import { adjustStock } from "@/modules/inventory/inventory.service";
import {
  getCatalogCounts,
  getCustomerSummary,
  getMonthlyTrends,
  getOrdersByChannel,
  getOrderStatusSummary,
  getSalesSummary,
  getTopCategories,
  getTopProducts,
  getYearlyTotals,
} from "@/modules/reports/dashboard";
import { saveShippingZone } from "@/modules/settings/commerce.service";
import { seedCatalog } from "../../prisma/fixtures/catalog";
import { createBusiness, createStaffActor, db, resetDatabase } from "../support/db";

let owner: StaffActor;
let businessId: string;

function png(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

const reader = (fields: Record<string, string>) => (name: string) => fields[name] ?? "";
const variantBySku = (sku: string) => db.productVariant.findFirstOrThrow({ where: { businessId, sku } });

async function buy(lines: [string, number][], phone: string) {
  const cart = await getOrCreateCart(businessId, null, null);
  for (const [sku, qty] of lines) await setCartQuantity(businessId, cart.id, (await variantBySku(sku)).id, qty, "set");
  return placeOrder(
    { businessId, cartToken: cart.token, userId: null },
    { name: "Test Buyer", phone, email: "", district: "dhaka", upazila: "Gulshan", area: "", addressLine: "House 1", note: "", paymentMethod: "COD", idempotencyKey: randomUUID().replace(/-/g, "") },
  );
}

beforeAll(async () => {
  await resetDatabase();
  businessId = (await createBusiness()).id;
  owner = await createStaffActor(businessId, "owner");
  await seedCatalog(owner);
  await saveShippingZone(owner, null, { name: "Inside Dhaka", districts: ["dhaka"], baseFee: "60", includedWeightGrams: 1000, extraPerKg: "20" });
  for (const sku of ["HOM-MUG-4", "AUD-EARBUDS-PRO"]) await adjustStock(owner, { variantId: (await variantBySku(sku)).id, quantity: 30, reason: "OPENING_BALANCE" });
});

describe("homepage content", () => {
  it("saves one section at a time, validates links, and audits the change", async () => {
    await updateHomepageSection(owner, "general", reader({ announcement: "Free delivery over ৳5,000", "social.facebook": "https://facebook.com/example" }));
    await updateHomepageSection(owner, "statement", reader({ statement: "Hello", showStats: "on" }));
    const { content } = await getHomepageContentForAdmin(owner);
    expect(content.announcement).toBe("Free delivery over ৳5,000");
    expect(content.social.facebook).toBe("https://facebook.com/example");
    expect(content.statement).toBe("Hello");

    const invalid = updateHomepageSection(owner, "heroes", reader({ "heroes.0.title": "Hi", "heroes.0.href": "javascript:alert(1)" }));
    await expect(invalid).rejects.toBeInstanceOf(ValidationError);
    await expect(invalid).rejects.toMatchObject({ fieldErrors: { "heroes.0.href": expect.any(String) } });

    const audits = await db.auditLog.count({ where: { businessId, action: "content.homepage_updated" } });
    expect(audits).toBe(2);
  });

  it("only accepts this business's uploaded images and deletes replaced ones", async () => {
    const first = await uploadContentImage(owner, { name: "a.png", bytes: png(1600, 800) });
    expect(first.key).toMatch(/^content\/[0-9a-f]{2}\/[\w-]+\.png$/);
    await updateHomepageSection(owner, "heroes", reader({ "heroes.0.title": "Sale", "heroes.0.imageKey": first.key }));

    await expect(updateHomepageSection(owner, "heroes", reader({ "heroes.0.title": "Sale", "heroes.0.imageKey": "content/ab/notuploaded.png" }))).rejects.toThrow(/no longer available/);

    const second = await uploadContentImage(owner, { name: "b.png", bytes: png(1600, 800) });
    await updateHomepageSection(owner, "heroes", reader({ "heroes.0.title": "Sale", "heroes.0.imageKey": second.key }));
    expect(await db.contentMedia.findUnique({ where: { storageKey: first.key } })).toBeNull();
    expect(await getStorage().get(first.key)).toBeNull();
    expect(await getStorage().get(second.key)).not.toBeNull();

    await expect(uploadContentImage(owner, { name: "x.txt", bytes: new TextEncoder().encode("not an image") })).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires a real coupon for the sale countdown and content.manage permission", async () => {
    await expect(updateHomepageSection(owner, "sale", reader({ "sale.couponCode": "NOPE" }))).rejects.toMatchObject({ fieldErrors: { "sale.couponCode": expect.any(String) } });
    await saveCoupon(owner, null, { code: "SEASON", type: "PERCENT", percent: "15", endsAt: "2099-01-01T00:00" });
    await updateHomepageSection(owner, "sale", reader({ "sale.couponCode": "season" }));
    expect((await getHomepageContentForAdmin(owner)).content.sale.couponCode).toBe("SEASON");

    const warehouse = await createStaffActor(businessId, "inventory_operator");
    await expect(updateHomepageSection(warehouse, "general", reader({}))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores newsletter sign-ups once per address", async () => {
    await subscribeToNewsletter("Reader@Example.test", "198.51.100.7");
    await subscribeToNewsletter("reader@example.test", "198.51.100.7");
    expect(await db.newsletterSubscriber.count({ where: { businessId } })).toBe(1);
    await expect(subscribeToNewsletter("not-an-email", "198.51.100.7")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("dashboard reporting", () => {
  it("returns zeros, not invented figures, before any sale", async () => {
    const sales = await getSalesSummary(owner, "all");
    expect(sales.revenue.value).toBe(0);
    expect(sales.orders.value).toBe(0);
    expect(sales.revenue.delta.percent).toBeNull();
    expect(await getTopProducts(owner, "all")).toEqual([]);
    expect((await getCustomerSummary(owner, "all")).repeatPurchasePercent).toBeNull();
  });

  it("computes sales, profit, channels, statuses and rankings from real orders", async () => {
    const mug = await variantBySku("HOM-MUG-4");
    await db.productVariant.update({ where: { id: mug.id }, data: { costMinor: 80000 } });
    const a = await buy([["HOM-MUG-4", 2]], "01711000001");
    const b = await buy([["AUD-EARBUDS-PRO", 1]], "01711000002");
    await buy([["HOM-MUG-4", 1]], "01711000001");
    const cancelled = await buy([["HOM-MUG-4", 1]], "01711000003");
    await db.order.update({ where: { businessId_number: { businessId, number: cancelled.number } }, data: { status: "CANCELLED" } });

    const orders = await db.order.findMany({ where: { businessId, status: { not: "CANCELLED" } } });
    const expectedRevenue = orders.reduce((s, o) => s + o.totalMinor, 0);

    const sales = await getSalesSummary(owner, "month");
    expect(sales.orders.value).toBe(3);
    expect(sales.revenue.value).toBe(expectedRevenue);
    expect(sales.aov.value).toBe(Math.round(expectedRevenue / 3));

    // Gross profit = net line revenue − cost snapshot, over lines that have a cost.
    const lines = await db.orderItem.findMany({ where: { order: { businessId, status: { not: "CANCELLED" } } } });
    const costed = lines.filter((l) => l.unitCostMinor !== null);
    const expectedProfit = costed.reduce((s, l) => s + l.lineTotalMinor - l.taxMinor - l.unitCostMinor! * l.quantity, 0);
    expect(lines.filter((l) => l.sku === "HOM-MUG-4").every((l) => l.unitCostMinor === 80000)).toBe(true);
    expect(sales.grossProfit.uncostedLines).toBe(lines.length - costed.length);
    expect(sales.grossProfit.value).toBe(expectedProfit);

    const channels = await getOrdersByChannel(owner, "month");
    expect(channels.find((c) => c.source === "WEBSITE")?.orders).toBe(3);
    expect(channels.some((c) => c.source === "POS")).toBe(false);

    const status = await getOrderStatusSummary(owner, "month");
    expect(status).toMatchObject({ total: 4, open: 3, closed: 1, awaiting: 3 });

    const customers = await getCustomerSummary(owner, "all");
    expect(customers.total).toBe(3);
    expect(customers.repeatPurchasePercent).toBe(50); // 1 of 2 buyers ordered twice (cancelled orders excluded)

    const products = await getTopProducts(owner, "month");
    expect(products[0]).toMatchObject({ title: "Stoneware Mug Set of 4", units: 3 });
    const categories = await getTopCategories(owner, "month");
    expect(categories[0]!.units).toBe(3);

    const trends = await getMonthlyTrends(owner);
    const thisMonth = trends[trends.length - 1]!;
    expect(thisMonth.websiteMinor).toBe(expectedRevenue);
    expect(thisMonth.newCustomers).toBe(2);
    expect(thisMonth.revenuePerCustomerMinor).toBe(Math.round(expectedRevenue / 2));

    const years = await getYearlyTotals(owner);
    expect(years.at(-1)!.revenueMinor).toBe(expectedRevenue);
    expect(years.at(-1)!.grossProfitMinor).toBe(expectedProfit);
    expect(a.number).not.toBe(b.number);
  });

  it("counts catalog and stock states", async () => {
    const counts = await getCatalogCounts(owner);
    expect(counts.products.total).toBe(await db.product.count({ where: { businessId, status: { not: "ARCHIVED" } } }));
    expect(counts.categories.total).toBe(await db.category.count({ where: { businessId } }));
    expect(counts.stock.outOfStock).toBeGreaterThan(0); // seeded variants without stock
  });

  it("is restricted to reports.view", async () => {
    const courier = await createStaffActor(businessId, "courier_operator");
    expect(courier.permissions.has("reports.view")).toBe(false);
    await expect(getSalesSummary(courier, "month")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getCatalogCounts(courier)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
