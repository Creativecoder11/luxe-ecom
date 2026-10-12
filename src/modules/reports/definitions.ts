/**
 * Metric definitions shared by the dashboard, reports and storefront figures (PRD §15).
 * Every number shown anywhere is computed from records using these rules.
 */

/** Orders that never count as sales: drafts and cancellations. Returns are counted (gross, before returns). */
export const NON_REVENUE_STATUSES = ["DRAFT", "CANCELLED"] as const;

/** Statuses still moving through fulfilment. */
export const OPEN_STATUSES = ["PENDING_CONFIRMATION", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] as const;

/**
 * Compact count that never overstates: 999 → "999", 1,250 → "1.2K+", 2,000 → "2K+".
 * Values are floored, and "+" is added only when digits were dropped.
 */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.floor(n)));
  const units: [number, string][] = [
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const tenths = Math.floor((n / size) * 10) / 10;
      const label = Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
      return `${label}${suffix}${tenths * size === n ? "" : "+"}`;
    }
  }
  return String(n);
}

/** Percentage change (rounded to 0.1) or null when there is no baseline to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Ratio as a percentage rounded to 0.1, or null when the denominator is zero. */
export function ratioPercent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** Business time is Asia/Dhaka: UTC+6 all year (no daylight saving). */
export const BUSINESS_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

export type RangeKey = "month" | "year" | "all";
export const RANGE_KEYS: readonly RangeKey[] = ["month", "year", "all"];
export const RANGE_LABEL: Record<RangeKey, string> = { month: "This month", year: "This year", all: "All time" };

export function parseRange(value: unknown, fallback: RangeKey): RangeKey {
  return typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value) ? (value as RangeKey) : fallback;
}

export interface Period {
  /** Inclusive start (null = since the beginning). */
  start: Date | null;
  /** Exclusive end: "now" for to-date periods. */
  end: Date;
  /** The same elapsed span one month/year earlier, for like-for-like comparison. */
  previous: { start: Date; end: Date } | null;
  comparisonLabel: string | null;
}

/** Start of the business-local month/year containing `now`, as a UTC instant. */
export function businessPeriodStart(range: "month" | "year", now: Date, offsetUnits = 0): Date {
  const local = new Date(now.getTime() + BUSINESS_UTC_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const startLocal = range === "month" ? Date.UTC(y, m + offsetUnits, 1) : Date.UTC(y + offsetUnits, 0, 1);
  return new Date(startLocal - BUSINESS_UTC_OFFSET_MS);
}

/**
 * Period-to-date bounds. Month-to-date is compared with the same number of elapsed days of the
 * previous month (not the whole month), so a partial month is never compared with a full one.
 */
export function periodFor(range: RangeKey, now: Date = new Date()): Period {
  if (range === "all") return { start: null, end: now, previous: null, comparisonLabel: null };
  const start = businessPeriodStart(range, now);
  const prevStart = businessPeriodStart(range, now, -1);
  const elapsed = now.getTime() - start.getTime();
  const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, start.getTime()));
  return { start, end: now, previous: { start: prevStart, end: prevEnd }, comparisonLabel: range === "month" ? "vs same days last month" : "vs same period last year" };
}

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "YYYY-MM" keys for January … the current business month of `now`'s year. */
export function monthKeysThisYear(now: Date = new Date()): string[] {
  const local = new Date(now.getTime() + BUSINESS_UTC_OFFSET_MS);
  const y = local.getUTCFullYear();
  return Array.from({ length: local.getUTCMonth() + 1 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}
