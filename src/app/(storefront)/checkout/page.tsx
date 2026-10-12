import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StorefrontPageHeader } from "@/components/storefront/page-header";
import { Alert, Skeleton } from "@/components/ui/display";
import { DISTRICTS, DIVISIONS } from "@/lib/bd-geo";
import { normalizeBdMobile } from "@/lib/phone";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { loadCartView } from "@/modules/cart/cart.service";
import { getLastShippingDetails, quoteCheckout } from "@/modules/checkout/checkout.service";
import { getCustomerUser } from "@/modules/identity/session";
import { getCommerceSettingsForStore } from "@/modules/settings/store-settings";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const districtGroups = DIVISIONS.map((division) => ({
  division,
  options: DISTRICTS.filter((d) => d.division === division).map((d) => ({ code: d.code, name: d.name })),
}));

async function Checkout() {
  const businessId = await getBusinessId();
  const [token, user, settings] = await Promise.all([readCartToken(), getCustomerUser(), getCommerceSettingsForStore(businessId)]);
  const view = await loadCartView(businessId, token);
  if (view.lines.length === 0) redirect("/cart");
  if (view.hasProblems) redirect("/cart");
  if (!user && !settings.guestCheckoutEnabled) {
    return (
      <Alert tone="info" title="Please sign in to check out">
        <Link href="/login?next=/checkout" className="underline">Sign in</Link> or <Link href="/register?next=/checkout" className="underline">create an account</Link>.
      </Alert>
    );
  }
  if (!settings.codEnabled) {
    return <Alert tone="warning" title="Ordering is paused">Cash on Delivery is currently unavailable. Please check back soon.</Alert>;
  }

  const last = user ? await getLastShippingDetails(businessId, user.id) : null;
  const phone = last?.phone ?? user?.phone ?? "";
  const parsed = phone ? normalizeBdMobile(phone) : null;
  const prefill = {
    name: last?.name ?? user?.name ?? "",
    phone: parsed?.ok ? parsed.national : "",
    email: last?.email ?? user?.email ?? "",
    district: last?.district ?? "",
    upazila: last?.upazila ?? "",
    area: last?.area ?? "",
    addressLine: last?.addressLine ?? "",
  };
  const initialQuote = await quoteCheckout(businessId, token, prefill.district);

  return (
    <>
      {!user ? (
        <p className="mb-6 text-sm text-muted-foreground">
          Have an account? <Link href="/login?next=/checkout" className="font-medium text-foreground underline">Sign in</Link> for faster checkout. Or continue as a guest.
        </p>
      ) : null}
      <CheckoutForm
        idempotencyKey={randomBytes(18).toString("base64url")}
        districts={districtGroups}
        lines={view.lines.map((l) => ({ key: l.variantId, title: l.productTitle, variantTitle: l.variantTitle, quantity: l.quantity, lineTotalMinor: l.lineTotalMinor }))}
        initialQuote={initialQuote}
        prefill={prefill}
        couponCode={view.couponCode}
      />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <StorefrontPageHeader title="Checkout" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <Checkout />
        </Suspense>
      </div>
    </>
  );
}
