import { Banknote, Clock, MapPin, Truck } from "lucide-react";
import type { Metadata } from "next";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { findDistrict } from "@/lib/bd-geo";
import { formatMoney } from "@/lib/money";
import { getHomepageContent } from "@/modules/content/content.service";
import { getPublicDeliveryInfo } from "@/modules/content/storefront-data";

export const metadata: Metadata = {
  title: "Shipping & returns",
  description: "Delivery areas, fees, Cash on Delivery and our returns policy.",
};

function districtList(codes: string[]) {
  const names = codes.map((c) => findDistrict(c)?.name ?? c);
  return names.length > 6 ? `${names.slice(0, 6).join(", ")} and ${names.length - 6} more` : names.join(", ");
}

/** Every figure here is read from Settings → Delivery zones and Settings → Cash on Delivery. */
export default async function ShippingReturnsPage() {
  const [delivery, content] = await Promise.all([getPublicDeliveryInfo(), getHomepageContent()]);
  return (
    <>
      <StorefrontPageHeader title="Shipping & returns" description="Where we deliver, what it costs, and how returns work." />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="text-2xl font-bold">
            Delivery areas and fees
          </h2>
          {delivery.zones.length === 0 ? (
            <p className="mt-4 text-muted-foreground">Delivery areas have not been published yet. Fees are shown at checkout.</p>
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {delivery.zones.map((z) => (
                <li key={z.name} className="rounded-2xl border border-border bg-surface p-6">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <MapPin className="size-5 text-accent" aria-hidden="true" /> {z.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{z.isFallback ? "All other districts of Bangladesh" : districtList(z.districts)}</p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Truck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Delivery fee</dt>
                      <dd>
                        {formatMoney(z.baseFeeMinor, "BDT")} up to {z.includedWeightGrams / 1000} kg
                        {z.extraPerKgMinor ? `, then ${formatMoney(z.extraPerKgMinor, "BDT")} per extra kg` : ""}
                        {z.freeShippingThresholdMinor !== null ? `. Free on orders of ${formatMoney(z.freeShippingThresholdMinor, "BDT")} or more` : ""}.
                      </dd>
                    </div>
                    {z.estimate ? (
                      <div className="flex items-start gap-2">
                        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Estimated delivery</dt>
                        <dd>Estimated delivery: {z.estimate}</dd>
                      </div>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <Banknote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <dt className="sr-only">Cash on Delivery</dt>
                      <dd>
                        {delivery.codEnabled && z.codEnabled
                          ? `Cash on Delivery available${z.codFeeMinor ? ` (${formatMoney(z.codFeeMinor, "BDT")} COD fee)` : ""}`
                          : "Cash on Delivery not available"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {delivery.codEnabled && delivery.codMaxOrderMinor !== null ? (
            <p className="mt-4 text-sm text-muted-foreground">Cash on Delivery is available for orders up to {formatMoney(delivery.codMaxOrderMinor, "BDT")}.</p>
          ) : null}
        </section>

        <section aria-labelledby="returns-heading">
          <h2 id="returns-heading" className="text-2xl font-bold">
            Returns
          </h2>
          {content.shippingReturns ? (
            <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/90">{content.shippingReturns}</div>
          ) : (
            <p className="mt-4 text-muted-foreground">Our returns policy will be published here soon. Product pages show any product-specific return notes.</p>
          )}
        </section>
      </div>
    </>
  );
}
