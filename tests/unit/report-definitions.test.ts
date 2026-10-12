import { describe, expect, it } from "vitest";
import { compactCount, monthKeysThisYear, parseRange, percentChange, periodFor, ratioPercent } from "@/modules/reports/definitions";

describe("compactCount", () => {
  it("never overstates a figure", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1000)).toBe("1K");
    expect(compactCount(1250)).toBe("1.2K+");
    expect(compactCount(1999)).toBe("1.9K+");
    expect(compactCount(2_000_000)).toBe("2M");
    expect(compactCount(-5)).toBe("0");
  });
});

describe("percentChange / ratioPercent", () => {
  it("returns null without a baseline", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(ratioPercent(1, 0)).toBeNull();
  });
  it("rounds to one decimal", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(1, 3)).toBe(-66.7);
    expect(ratioPercent(1, 3)).toBe(33.3);
  });
});

describe("periodFor (Asia/Dhaka, UTC+6)", () => {
  // 2026-03-01 02:00 in Dhaka is still 2026-02-28 20:00 UTC.
  const now = new Date("2026-02-28T20:00:00Z");

  it("uses business-local month boundaries", () => {
    const p = periodFor("month", now);
    expect(p.start?.toISOString()).toBe("2026-02-28T18:00:00.000Z"); // 1 Mar 00:00 Dhaka
    expect(p.previous?.start.toISOString()).toBe("2026-01-31T18:00:00.000Z"); // 1 Feb 00:00 Dhaka
    // Same elapsed span (2 hours) of the previous month.
    expect(p.previous?.end.toISOString()).toBe("2026-01-31T20:00:00.000Z");
  });

  it("caps the comparison span at the previous period's end", () => {
    // 31 Mar: previous month (Feb) has only 28 days.
    const p = periodFor("month", new Date("2026-03-31T12:00:00Z"));
    expect(p.previous!.end.getTime()).toBeLessThanOrEqual(p.start!.getTime());
  });

  it("has no comparison for all time", () => {
    const p = periodFor("all", now);
    expect(p.start).toBeNull();
    expect(p.previous).toBeNull();
  });

  it("year starts on 1 January Dhaka time", () => {
    expect(periodFor("year", new Date("2025-12-31T19:00:00Z")).start?.toISOString()).toBe("2025-12-31T18:00:00.000Z");
  });
});

describe("monthKeysThisYear / parseRange", () => {
  it("lists months up to the current business month", () => {
    expect(monthKeysThisYear(new Date("2026-02-28T20:00:00Z"))).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
  it("accepts only known ranges", () => {
    expect(parseRange("year", "month")).toBe("year");
    expect(parseRange("forever", "month")).toBe("month");
    expect(parseRange(["year"], "all")).toBe("all");
  });
});
