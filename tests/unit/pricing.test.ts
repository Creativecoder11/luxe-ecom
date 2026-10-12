import { describe, expect, it } from "vitest";
import { DISTRICTS, DIVISIONS, findDistrict } from "@/lib/bd-geo";
import { priceOrder, shippingFee, type ZoneRule } from "@/modules/checkout/pricing";

const dhaka: ZoneRule = { baseFeeMinor: 6000, includedWeightGrams: 1000, extraPerKgMinor: 2000, freeShippingThresholdMinor: null, codEnabled: true, codFeeMinor: 0 };
const outside: ZoneRule = { ...dhaka, baseFeeMinor: 12000, codFeeMinor: 1000 };
const line = (key: string, price: number, qty: number, tax = 0, weight: number | null = 300) => ({ key, unitPriceMinor: price, quantity: qty, taxRateBasisPoints: tax, weightGrams: weight });

describe("Bangladesh geography", () => {
  it("has 8 divisions and 64 districts with unique codes", () => {
    expect(DIVISIONS).toHaveLength(8);
    expect(DISTRICTS).toHaveLength(64);
    expect(new Set(DISTRICTS.map((d) => d.code)).size).toBe(64);
    expect(findDistrict("coxs-bazar")).toEqual({ code: "coxs-bazar", name: "Cox's Bazar", division: "Chattogram" });
  });
});

describe("shipping fee", () => {
  it("charges the base fee up to the included weight, then per started kg", () => {
    expect(shippingFee(dhaka, 0, 0)).toBe(6000);
    expect(shippingFee(dhaka, 1000, 0)).toBe(6000);
    expect(shippingFee(dhaka, 1001, 0)).toBe(8000);
    expect(shippingFee(dhaka, 3500, 0)).toBe(6000 + 3 * 2000);
  });
  it("is free at or above the threshold", () => {
    const zone = { ...dhaka, freeShippingThresholdMinor: 300000 };
    expect(shippingFee(zone, 5000, 300000)).toBe(0);
    expect(shippingFee(zone, 5000, 299999)).toBe(14000);
  });
});

describe("priceOrder", () => {
  it("computes a VAT-inclusive COD order outside Dhaka", () => {
    const r = priceOrder({ lines: [line("a", 115000, 2, 1500), line("b", 50000, 1, 0)], pricesIncludeTax: true, zone: outside, paymentMethod: "COD" });
    expect(r.subtotalMinor).toBe(280000);
    // 230000 × 15/115 = 30000 included VAT; the total does not change.
    expect(r.taxMinor).toBe(30000);
    expect(r.shippingMinor).toBe(12000);
    expect(r.codFeeMinor).toBe(1000);
    expect(r.totalMinor).toBe(280000 + 12000 + 1000);
  });

  it("adds VAT on top when prices exclude it", () => {
    const r = priceOrder({ lines: [line("a", 100000, 1, 1500)], pricesIncludeTax: false, zone: dhaka, paymentMethod: "COD" });
    expect(r.taxMinor).toBe(15000);
    expect(r.lines[0]!.lineTotalMinor).toBe(115000);
    expect(r.totalMinor).toBe(100000 + 15000 + 6000);
  });

  it("allocates a percentage discount exactly across lines and taxes the net amount", () => {
    const r = priceOrder({
      lines: [line("a", 100000, 1, 1500), line("b", 50000, 1, 1500)],
      pricesIncludeTax: false,
      coupon: { type: "PERCENT", percentBasisPoints: 1000, maxDiscountMinor: null },
      zone: null,
      paymentMethod: null,
    });
    expect(r.discountMinor).toBe(15000);
    expect(r.lines.map((l) => l.discountMinor)).toEqual([10000, 5000]);
    expect(r.taxMinor).toBe(13500 + 6750);
    expect(r.shippingMinor).toBeNull();
    expect(r.totalMinor).toBe(150000 - 15000 + 20250);
  });

  it("caps percent discounts, limits fixed discounts to the subtotal and enforces minimum subtotals", () => {
    const capped = priceOrder({ lines: [line("a", 1_000_000, 1)], pricesIncludeTax: true, coupon: { type: "PERCENT", percentBasisPoints: 5000, maxDiscountMinor: 50000 }, zone: null, paymentMethod: null });
    expect(capped.discountMinor).toBe(50000);
    const fixed = priceOrder({ lines: [line("a", 30000, 1)], pricesIncludeTax: true, coupon: { type: "FIXED", amountMinor: 50000 }, zone: null, paymentMethod: null });
    expect(fixed.discountMinor).toBe(30000);
    expect(fixed.totalMinor).toBe(0);
    const tooSmall = priceOrder({ lines: [line("a", 30000, 1)], pricesIncludeTax: true, coupon: { type: "FIXED", amountMinor: 5000, minSubtotalMinor: 100000 }, zone: null, paymentMethod: null });
    expect(tooSmall.discountMinor).toBe(0);
    expect(tooSmall.couponApplied).toBe(false);
    expect(tooSmall.couponNote).toBe("minimum_subtotal");
  });

  it("applies free-shipping coupons and weight-based fees", () => {
    const heavy = [line("a", 50000, 4, 0, 800)];
    expect(priceOrder({ lines: heavy, pricesIncludeTax: true, zone: dhaka, paymentMethod: "COD" }).shippingMinor).toBe(6000 + 3 * 2000);
    expect(priceOrder({ lines: heavy, pricesIncludeTax: true, coupon: { type: "FREE_SHIPPING" }, zone: dhaka, paymentMethod: "COD" }).shippingMinor).toBe(0);
  });

  it("measures the free-delivery threshold after discounts", () => {
    const zone = { ...dhaka, freeShippingThresholdMinor: 100000 };
    const r = priceOrder({ lines: [line("a", 100000, 1)], pricesIncludeTax: true, coupon: { type: "FIXED", amountMinor: 1 }, zone, paymentMethod: "COD" });
    expect(r.shippingMinor).toBe(6000);
  });

  it("rejects invalid quantities and prices", () => {
    expect(() => priceOrder({ lines: [line("a", 100, 0)], pricesIncludeTax: true, zone: null, paymentMethod: null })).toThrow(RangeError);
    expect(() => priceOrder({ lines: [line("a", 1.5, 1)], pricesIncludeTax: true, zone: null, paymentMethod: null })).toThrow();
  });
});
