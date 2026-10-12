"use server";

import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken } from "@/modules/cart/cart-cookie";
import { mergeCartsForUser } from "@/modules/cart/cart.service";
import { registerCustomer, requestPasswordReset, resetPassword, signInCustomer } from "@/modules/identity/auth-flows";

/** Keeps what a guest put in the cart when they sign in or register. */
async function adoptGuestCart(userId: string) {
  const token = await readCartToken();
  if (token) await mergeCartsForUser(await getBusinessId(), token, userId);
}

export async function signInCustomerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(() => signInCustomer(formToObject(form)));
  if (!result.ok) return keepValues({ ...result }, form, ["email"]);
  if (result.data) await adoptGuestCart(result.data);
  redirect(safeRedirectPath(form.get("next")));
}

export async function registerCustomerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(() => registerCustomer(formToObject(form)));
  if (!result.ok) return keepValues({ ...result }, form, ["name", "phone", "email"]);
  if (result.data) await adoptGuestCart(result.data);
  redirect(safeRedirectPath(form.get("next")));
}

export async function requestPasswordResetAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(() => requestPasswordReset(formToObject(form)));
  if (!result.ok) return keepValues(result, form, ["email"]);
  return { ok: true, message: "If an account exists for that email, a reset link has been requested." };
}

export async function resetPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(() => resetPassword(formToObject(form)));
  if (result.ok) redirect("/login?reset=1");
  return result;
}
