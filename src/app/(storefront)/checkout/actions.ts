"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { getRequestMeta } from "@/lib/request";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { consumeCheckoutRateLimit, placeOrder, quoteCheckout, type CheckoutQuote } from "@/modules/checkout/checkout.service";
import { STOREFRONT_STATS_TAG } from "@/modules/content/storefront-data";
import { getCustomerUser } from "@/modules/identity/session";

export async function quoteCheckoutAction(district: string): Promise<CheckoutQuote> {
  return quoteCheckout(await getBusinessId(), await readCartToken(), String(district).slice(0, 40));
}

export async function placeOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { ip } = await getRequestMeta();
    await consumeCheckoutRateLimit(ip);
    const user = await getCustomerUser();
    return placeOrder({ businessId: await getBusinessId(), cartToken: await readCartToken(), userId: user?.id ?? null }, formToObject(form));
  });
  // Best sellers and store figures refresh in the background; the shopper never waits for it.
  if (result.ok) revalidateTag(STOREFRONT_STATS_TAG, "max");
  if (!result.ok) return keepValues({ ...result }, form, ["name", "phone", "email", "district", "upazila", "area", "addressLine", "note"]);
  redirect(`/checkout/success/${result.data!.publicToken}`);
}
