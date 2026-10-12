"use server";

import { refresh, updateTag } from "next/cache";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { saveCoupon } from "@/modules/checkout/coupon.service";
import { STOREFRONT_STATS_TAG } from "@/modules/content/storefront-data";
import { requireStaff } from "@/modules/identity/session";

export async function saveCouponAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("couponId") ?? "") || null;
  const result = await runAction(() => saveCoupon(actor, id, { ...formToObject(form), isActive: form.get("isActive") === "on" }), { message: "Coupon saved." });
  if (result.ok) {
    // The homepage sale countdown reads coupons.
    updateTag(STOREFRONT_STATS_TAG);
    refresh();
  }
  return keepValues(result, form, ["code", "description", "type", "percent", "amount", "maxDiscount", "minSubtotal", "startsAt", "endsAt", "usageLimit", "perCustomerLimit"]);
}
