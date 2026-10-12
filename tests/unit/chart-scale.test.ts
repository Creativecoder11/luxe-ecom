import { describe, expect, it } from "vitest";
import { compactNumber, monotonePath, niceTicks } from "@/components/admin/charts/scale";

describe("niceTicks", () => {
  it("covers the maximum with round steps from zero", () => {
    expect(niceTicks(3100)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(niceTicks(0)).toEqual([0, 1]);
    const t = niceTicks(97);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(97);
  });
  it("uses whole numbers for counts", () => {
    expect(niceTicks(1, 4, true)).toEqual([0, 1]);
    expect(niceTicks(7, 4, true).every(Number.isInteger)).toBe(true);
  });
});

describe("monotonePath", () => {
  it("never overshoots between equal neighbours", () => {
    const d = monotonePath([
      { x: 0, y: 100 },
      { x: 10, y: 100 },
      { x: 20, y: 0 },
    ]);
    // Control points of the flat first segment stay on y=100 (no bump above or below the data).
    const firstCurve = d.split(" C")[1]!.split(" ").map((p) => Number(p.split(",")[1]));
    expect(firstCurve).toEqual([100, 100, 100]);
    // And the descending segment never goes below 0.
    const second = d.split(" C")[2]!.split(" ").map((p) => Number(p.split(",")[1]));
    expect(Math.min(...second)).toBeGreaterThanOrEqual(0);
  });
  it("handles empty and single points", () => {
    expect(monotonePath([])).toBe("");
    expect(monotonePath([{ x: 1, y: 2 }])).toBe("M1,2");
  });
});

describe("compactNumber", () => {
  it("uses lakh and crore", () => {
    expect(compactNumber(1500)).toBe("1.5k");
    expect(compactNumber(250000)).toBe("2.5L");
    expect(compactNumber(12000000)).toBe("1.2Cr");
    expect(compactNumber(40)).toBe("40");
  });
});
