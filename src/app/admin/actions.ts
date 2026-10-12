"use server";

import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { changeOwnPassword, signInStaff, signOut } from "@/modules/identity/auth-flows";
import { requireStaff } from "@/modules/identity/session";

export async function signInStaffAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(() => signInStaff(formToObject(form)));
  if (result.ok) redirect("/admin");
  return keepValues(result, form, ["email"]);
}

export async function signOutStaffAction() {
  await signOut();
  redirect("/admin/login");
}

export async function changeStaffPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff({ allowPasswordChange: true });
  const result = await runAction(() => changeOwnPassword(actor.userId, formToObject(form)));
  if (result.ok) redirect("/admin");
  return result;
}
