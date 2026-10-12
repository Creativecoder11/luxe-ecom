import { describe, expect, it } from "vitest";
import { movingAverageCost } from "@/modules/purchasing/costing";

describe("moving weighted average cost", () => {
  it("weights existing stock and the new receipt", () => {
    expect(movingAverageCost(10, 10000, 10, 12000)).toBe(11000);
    expect(movingAverageCost(30, 10000, 10, 14000)).toBe(11000);
    expect(movingAverageCost(3, 100, 1, 101)).toBe(100); // 400.25 rounds to 100
  });
  it("uses the receipt cost when there is no prior cost or stock", () => {
    expect(movingAverageCost(0, 10000, 5, 12000)).toBe(12000);
    expect(movingAverageCost(5, null, 5, 12000)).toBe(12000);
  });
  it("rejects invalid quantities", () => {
    expect(() => movingAverageCost(1, 1, 0, 1)).toThrow(RangeError);
  });
});
