/**
 * Order pricing: the single source of truth for totals. Pure and deterministic; the server
 * recomputes every total with this (client-submitted prices are never trusted, FR-COM-01).
 *
 * Definitions:
 *   subtotal  = Σ unit price × quantity (catalog prices)
 *   discount  = coupon discount, allocated across lines in proportion to line subtotals
 *   tax       = VAT per line on (line subtotal − line discount):
 *               inclusive prices → tax = net × r / (1 + r)   (already inside the price)
 *               exclusive prices → tax = net × r              (added to the total)
 *   shipping  = zone base fee for the included weight + extra per started kg; free above the
 *               zone's threshold (measured on subtotal − discount) or with a free-delivery coupon
 *   codFee    = zone COD fee when paying cash on delivery
 *   total     = subtotal − discount + shipping + codFee (+ tax when prices exclude VAT)
 * Delivery fees are not taxed until the VAT policy says otherwise (D-028).
 */
import { allocateMinor, assertStorable, percentOfMinor, sumMinor } from "@/lib/money";

export interface PricingLineInput {
  key: string;
  unitPriceMinor: number;
  quantity: number;
  /** VAT rate in basis points (1500 = 15%). */
  taxRateBasisPoints: number;
  weightGrams: number | null;
}

export type CouponRule =
  | { type: "PERCENT"; percentBasisPoints: number; maxDiscountMinor?: number | null; minSubtotalMinor?: number | null }
  | { type: "FIXED"; amountMinor: number; minSubtotalMinor?: number | null }
  | { type: "FREE_SHIPPING"; minSubtotalMinor?: number | null };

export interface ZoneRule {
  baseFeeMinor: number;
  includedWeightGrams: number;
  extraPerKgMinor: number;
  freeShippingThresholdMinor: number | null;
  codEnabled: boolean;
  codFeeMinor: number;
}

export interface PricingInput {
  lines: PricingLineInput[];
  pricesIncludeTax: boolean;
  coupon?: CouponRule | null;
  /** null when the address is not yet known (cart page): shipping is then not included. */
  zone: ZoneRule | null;
  paymentMethod: "COD" | null;
}

export interface PricedLine {
  key: string;
  lineSubtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  /** What the customer pays for the line (inclusive: net; exclusive: net + tax). */
  lineTotalMinor: number;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number | null;
  codFeeMinor: number;
  taxMinor: number;
  pricesIncludeTax: boolean;
  totalMinor: number;
  totalWeightGrams: number;
  couponApplied: boolean;
  /** Why a supplied coupon gave no benefit (e.g. below the minimum subtotal). */
  couponNote: string | null;
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

export function shippingFee(zone: ZoneRule, totalWeightGrams: number, eligibleSubtotalMinor: number): number {
  if (zone.freeShippingThresholdMinor !== null && eligibleSubtotalMinor >= zone.freeShippingThresholdMinor) return 0;
  const extraGrams = Math.max(0, totalWeightGrams - zone.includedWeightGrams);
  return zone.baseFeeMinor + Math.ceil(extraGrams / 1000) * zone.extraPerKgMinor;
}

export function priceOrder(input: PricingInput): PricingResult {
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new RangeError("quantity must be a positive integer");
    assertStorable(line.unitPriceMinor);
    if (line.taxRateBasisPoints < 0 || line.taxRateBasisPoints > 10_000) throw new RangeError("invalid tax rate");
  }
  const subtotals = input.lines.map((l) => l.unitPriceMinor * l.quantity);
  const subtotalMinor = sumMinor(subtotals);
  const totalWeightGrams = input.lines.reduce((w, l) => w + (l.weightGrams ?? 0) * l.quantity, 0);

  // Coupon.
  let discountMinor = 0;
  let freeShipping = false;
  let couponApplied = false;
  let couponNote: string | null = null;
  const coupon = input.coupon;
  if (coupon) {
    if (coupon.minSubtotalMinor && subtotalMinor < coupon.minSubtotalMinor) {
      couponNote = "minimum_subtotal";
    } else if (coupon.type === "PERCENT") {
      discountMinor = percentOfMinor(subtotalMinor, coupon.percentBasisPoints);
      if (coupon.maxDiscountMinor) discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
      couponApplied = discountMinor > 0;
    } else if (coupon.type === "FIXED") {
      discountMinor = Math.min(coupon.amountMinor, subtotalMinor);
      couponApplied = discountMinor > 0;
    } else {
      freeShipping = true;
      couponApplied = true;
    }
  }
  const lineDiscounts = discountMinor > 0 && subtotalMinor > 0 ? allocateMinor(discountMinor, subtotals) : subtotals.map(() => 0);

  // VAT per line.
  const lines: PricedLine[] = input.lines.map((line, i) => {
    const net = subtotals[i]! - lineDiscounts[i]!;
    const r = line.taxRateBasisPoints;
    const taxMinor = r === 0 ? 0 : input.pricesIncludeTax ? roundHalfUp((net * r) / (10_000 + r)) : roundHalfUp((net * r) / 10_000);
    return {
      key: line.key,
      lineSubtotalMinor: subtotals[i]!,
      discountMinor: lineDiscounts[i]!,
      taxMinor,
      lineTotalMinor: input.pricesIncludeTax ? net : net + taxMinor,
    };
  });
  const taxMinor = sumMinor(lines.map((l) => l.taxMinor));

  const merchandise = subtotalMinor - discountMinor;
  const shippingMinor = input.zone ? (freeShipping ? 0 : shippingFee(input.zone, totalWeightGrams, merchandise)) : null;
  const codFeeMinor = input.zone && input.paymentMethod === "COD" ? input.zone.codFeeMinor : 0;
  const totalMinor = merchandise + (shippingMinor ?? 0) + codFeeMinor + (input.pricesIncludeTax ? 0 : taxMinor);

  return {
    lines,
    subtotalMinor,
    discountMinor,
    shippingMinor,
    codFeeMinor,
    taxMinor,
    pricesIncludeTax: input.pricesIncludeTax,
    totalMinor: assertStorable(totalMinor),
    totalWeightGrams,
    couponApplied,
    couponNote,
  };
}
