import { describe, expect, it } from "vitest";
import {
  allocateMinor,
  assertStorable,
  formatMoney,
  multiplyMinor,
  parseMajorToMinor,
  percentOfMinor,
  sumMinor,
} from "@/lib/money";

describe("money (integer minor units)", () => {
  it("sums and multiplies exactly", () => {
    expect(sumMinor([10, 20, 70])).toBe(100);
    // 0.1 + 0.2 style float errors are impossible with integers.
    expect(sumMinor([10, 20])).toBe(30);
    expect(multiplyMinor(12_550, 3)).toBe(37_650);
  });

  it("rejects non-integer amounts and quantities", () => {
    expect(() => sumMinor([1.5])).toThrow(TypeError);
    expect(() => multiplyMinor(100, 1.5)).toThrow(TypeError);
    expect(() => multiplyMinor(100, -1)).toThrow(TypeError);
  });

  it("enforces the stored integer ceiling", () => {
    expect(assertStorable(2_147_483_647)).toBe(2_147_483_647);
    expect(() => assertStorable(2_147_483_648)).toThrow(RangeError);
  });

  it("computes percentages in basis points, rounding half away from zero", () => {
    expect(percentOfMinor(10_000, 1_500)).toBe(1_500); // 15% of ৳100
    expect(percentOfMinor(999, 500)).toBe(50); // 49.95 → 50
    expect(percentOfMinor(-999, 500)).toBe(-50);
  });

  it("allocates so parts always sum to the total", () => {
    const parts = allocateMinor(1_000, [1, 1, 1]);
    expect(parts).toEqual([334, 333, 333]);
    expect(sumMinor(parts)).toBe(1_000);
    expect(allocateMinor(-100, [1, 3])).toEqual([-25, -75]);
    expect(allocateMinor(5, [0, 10])).toEqual([0, 5]);
    expect(() => allocateMinor(5, [0, 0])).toThrow(RangeError);
  });

  it("parses user input without floating point", () => {
    expect(parseMajorToMinor("1,250.50")).toBe(125_050);
    expect(parseMajorToMinor("৳ 99")).toBe(9_900);
    expect(parseMajorToMinor("0.07")).toBe(7);
    expect(parseMajorToMinor("1.234")).toBeNull();
    expect(parseMajorToMinor("abc")).toBeNull();
    expect(parseMajorToMinor("")).toBeNull();
  });

  it("formats BDT with taka sign and lakh grouping", () => {
    expect(formatMoney(123_456_750)).toBe("৳12,34,567.50");
    expect(formatMoney(5_000, "BDT", { showDecimals: false })).toBe("৳50");
    expect(formatMoney(-5_000)).toBe("-৳50.00");
  });
});
