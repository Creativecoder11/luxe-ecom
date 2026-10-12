/**
 * Free-delivery progress for the mini cart. The delivery zone is unknown until checkout, so the
 * message names the zone(s) it applies to, using the lowest configured threshold. Mirrors
 * shippingFee(): eligible amount = subtotal − discount.
 */
export interface FreeDeliveryProgress {
  thresholdMinor: number;
  remainingMinor: number;
  /** 0–100, for the progress bar. */
  percent: number;
  zoneNames: string[];
}

export function freeDeliveryProgress(
  zones: { name: string; freeShippingThresholdMinor: number | null }[],
  eligibleSubtotalMinor: number,
): FreeDeliveryProgress | null {
  const withThreshold = zones.filter((z): z is { name: string; freeShippingThresholdMinor: number } => z.freeShippingThresholdMinor !== null && z.freeShippingThresholdMinor > 0);
  if (withThreshold.length === 0) return null;
  const thresholdMinor = Math.min(...withThreshold.map((z) => z.freeShippingThresholdMinor));
  const remainingMinor = Math.max(0, thresholdMinor - eligibleSubtotalMinor);
  return {
    thresholdMinor,
    remainingMinor,
    percent: Math.min(100, Math.floor((Math.max(0, eligibleSubtotalMinor) / thresholdMinor) * 100)),
    zoneNames: withThreshold.filter((z) => z.freeShippingThresholdMinor === thresholdMinor).map((z) => z.name),
  };
}
