/**
 * Money is always an integer number of minor units (e.g. poisha for BDT) plus an ISO 4217 code (D-005).
 * Never use floating-point major units for arithmetic.
 */

export const DEFAULT_CURRENCY = "BDT";

/** Postgres `integer` ceiling for a single stored amount. */
export const MAX_STORED_MINOR = 2_147_483_647;

const MINOR_DIGITS: Record<string, number> = { BDT: 2, USD: 2, EUR: 2, GBP: 2, INR: 2, JPY: 0 };

export function minorDigits(currency: string): number {
  const digits = MINOR_DIGITS[currency];
  if (digits === undefined) throw new Error(`Unsupported currency: ${currency}`);
  return digits;
}

export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
  return value;
}

export function assertStorable(value: number, label = "amount"): number {
  assertMinor(value, label);
  if (Math.abs(value) > MAX_STORED_MINOR) {
    throw new RangeError(`${label} exceeds the storable limit (${MAX_STORED_MINOR} minor units)`);
  }
  return value;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, v) => assertMinor(total + assertMinor(v)), 0);
}

export function multiplyMinor(unitAmount: number, quantity: number): number {
  assertMinor(unitAmount, "unitAmount");
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new TypeError(`quantity must be a non-negative integer, got ${quantity}`);
  }
  return assertMinor(unitAmount * quantity);
}

/**
 * Percentage of an amount expressed in basis points (1% = 100 bp), rounded half away from zero.
 * Used for discounts and tax so results stay integral.
 */
export function percentOfMinor(amount: number, basisPoints: number): number {
  assertMinor(amount);
  assertMinor(basisPoints, "basisPoints");
  const raw = (amount * basisPoints) / 10_000;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

/**
 * Splits `amount` across `weights` proportionally using the largest-remainder method,
 * so the parts always add up exactly to `amount` (e.g. an order discount across lines).
 */
export function allocateMinor(amount: number, weights: readonly number[]): number[] {
  assertMinor(amount);
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new TypeError("weights must be non-negative integers");
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) throw new RangeError("weights must not all be zero");

  const sign = Math.sign(amount);
  const absolute = Math.abs(amount);
  const parts = weights.map((w) => Math.floor((absolute * w) / totalWeight));
  let remainder = absolute - parts.reduce((a, b) => a + b, 0);

  const order = weights
    .map((w, index) => ({ index, fraction: ((absolute * w) % totalWeight) / totalWeight }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder === 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    remainder -= 1;
  }
  return parts.map((p) => (p === 0 ? 0 : p * sign));
}

/**
 * Parses a user-entered major-unit string ("1,250.5", "৳ 99") into minor units without floats.
 * Returns null when the input is not a valid amount with at most the currency's minor digits.
 */
export function parseMajorToMinor(input: string, currency = DEFAULT_CURRENCY): number | null {
  const digits = minorDigits(currency);
  const cleaned = input.replace(/[৳\s,]/g, "").replace(/^BDT/i, "");
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, negative, whole = "0", fraction = ""] = match;
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/**
 * Formats minor units for display. BDT uses the ৳ symbol with South Asian (lakh/crore) grouping.
 */
export function formatMoney(
  amountMinor: number,
  currency = DEFAULT_CURRENCY,
  options: { showDecimals?: boolean } = {},
): string {
  assertMinor(amountMinor);
  const digits = minorDigits(currency);
  const showDecimals = options.showDecimals ?? true;
  const locale = currency === "BDT" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: showDecimals ? digits : 0,
    maximumFractionDigits: showDecimals ? digits : 0,
  }).format(amountMinor / 10 ** digits);
}
