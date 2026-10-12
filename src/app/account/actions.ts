"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { changeOwnPassword, signOut } from "@/modules/identity/auth-flows";
import { updateCustomerProfile } from "@/modules/identity/customer.service";
import { removeFromWishlist } from "@/modules/cart/wishlist.service";
import { requireCustomer } from "@/modules/identity/session";

export async function signOutCustomerAction() {
  await signOut();
  redirect("/");
}

export async function updateProfileAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireCustomer("/account/profile");
  const result = await runAction(() => updateCustomerProfile(user.id, formToObject(form)), { message: "Profile saved." });
  if (result.ok) refresh();
  return keepValues(result, form, ["name", "phone"]);
}

export async function changeCustomerPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireCustomer("/account/profile");
  return runAction(() => changeOwnPassword(user.id, formToObject(form)), {
    message: "Password changed. Other devices were signed out.",
  });
}

export async function removeWishlistItemAction(form: FormData) {
  const user = await requireCustomer("/account/wishlist");
  await removeFromWishlist(user.id, String(form.get("productId") ?? ""));
  refresh();
}
