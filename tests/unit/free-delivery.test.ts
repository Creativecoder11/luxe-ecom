import { describe, expect, it } from "vitest";
import { freeDeliveryProgress } from "@/modules/cart/free-delivery";

const zones = [
  { name: "Inside Dhaka", freeShippingThresholdMinor: null },
  { name: "Rest of Bangladesh", freeShippingThresholdMinor: 500_000 },
  { name: "Chattogram", freeShippingThresholdMinor: 300_000 },
  { name: "Sylhet", freeShippingThresholdMinor: 300_000 },
];

describe("freeDeliveryProgress", () => {
  it("is null when no zone offers free delivery", () => {
    expect(freeDeliveryProgress([{ name: "A", freeShippingThresholdMinor: null }], 1000)).toBeNull();
    expect(freeDeliveryProgress([], 1000)).toBeNull();
  });
  it("uses the lowest threshold and names the zones it applies to", () => {
    expect(freeDeliveryProgress(zones, 120_000)).toEqual({ thresholdMinor: 300_000, remainingMinor: 180_000, percent: 40, zoneNames: ["Chattogram", "Sylhet"] });
  });
  it("caps at 100% once reached", () => {
    expect(freeDeliveryProgress(zones, 350_000)).toMatchObject({ remainingMinor: 0, percent: 100 });
  });
});
