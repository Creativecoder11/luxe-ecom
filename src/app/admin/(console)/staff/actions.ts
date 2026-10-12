"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { createRole, deleteRole, updateRole } from "@/modules/identity/roles.service";
import { requireStaff } from "@/modules/identity/session";
import { changeStaffRole, createStaff, resetStaffPassword, setStaffStatus } from "@/modules/identity/staff.service";

export async function createStaffAction(
  _prev: ActionResult<{ email: string; temporaryPassword: string }> | null,
  form: FormData,
): Promise<ActionResult<{ email: string; temporaryPassword: string }>> {
  const actor = await requireStaff();
  const input = formToObject(form);
  const result = await runAction(async () => {
    const { temporaryPassword } = await createStaff(actor, input);
    return { email: String(input.email ?? ""), temporaryPassword };
  });
  if (result.ok) refresh();
  return keepValues(result, form, ["name", "email", "phone", "jobTitle", "roleId"]);
}

export async function changeStaffRoleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => changeStaffRole(actor, String(form.get("staffId")), String(form.get("roleId"))), {
    message: "Role updated.",
  });
  if (result.ok) refresh();
  return result;
}

export async function setStaffStatusAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const status = form.get("status") === "ACTIVE" ? "ACTIVE" : "SUSPENDED";
  const result = await runAction(
    () => setStaffStatus(actor, String(form.get("staffId")), status, String(form.get("reason") ?? "")),
    { message: status === "ACTIVE" ? "Account reactivated." : "Account suspended and signed out." },
  );
  if (result.ok) refresh();
  return result;
}

export async function resetStaffPasswordAction(
  _prev: ActionResult<{ temporaryPassword: string }> | null,
  form: FormData,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const actor = await requireStaff();
  return runAction(() => resetStaffPassword(actor, String(form.get("staffId"))));
}

function readRoleForm(form: FormData) {
  return {
    name: form.get("name"),
    description: form.get("description") ?? "",
    permissions: form.getAll("permissions").map(String),
  };
}

export async function createRoleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => createRole(actor, readRoleForm(form)));
  if (result.ok) redirect("/admin/staff/roles");
  return keepValues(result as ActionResult, form, ["name", "description", "permissions"]);
}

export async function updateRoleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => updateRole(actor, String(form.get("roleId")), readRoleForm(form)), {
    message: "Role saved. Changes apply to staff immediately.",
  });
  if (result.ok) refresh();
  return keepValues(result, form, ["name", "description", "permissions"]);
}

export async function deleteRoleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => deleteRole(actor, String(form.get("roleId"))));
  if (result.ok) redirect("/admin/staff/roles");
  return result as ActionResult;
}
