"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { ValidationError } from "@/lib/errors";
import { requireStaff } from "@/modules/identity/session";
import { cancelPurchaseOrder, createPurchaseOrder, placePurchaseOrder, receivePurchaseOrder, saveSupplier } from "@/modules/purchasing/purchasing.service";

export async function saveSupplierAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("supplierId") ?? "") || null;
  const result = await runAction(async () => void (await saveSupplier(actor, id, { ...formToObject(form), isActive: form.get("isActive") === "on" })), { message: "Supplier saved." });
  if (result.ok) refresh();
  return keepValues(result, form, ["name", "contactName", "phone", "email", "address", "notes"]);
}

export async function createPurchaseOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(async () => {
    const raw = form.get("payload");
    if (typeof raw !== "string") throw new ValidationError("The form data was incomplete.");
    return createPurchaseOrder(actor, JSON.parse(raw));
  });
  if (!result.ok) return result;
  redirect(`/admin/purchasing/${result.data!.id}?created=1`);
}

export async function purchaseOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("purchaseOrderId") ?? "");
  const op = String(form.get("op") ?? "");
  const result = await runAction(async () => {
    if (op === "place") return void (await placePurchaseOrder(actor, id));
    if (op === "cancel") return void (await cancelPurchaseOrder(actor, id, String(form.get("reason") ?? "")));
    if (op === "receive") {
      const lines = form.getAll("itemId").map((itemId, i) => ({ itemId: String(itemId), quantity: form.getAll("quantity")[i] ?? "0" }));
      return void (await receivePurchaseOrder(actor, id, { lines, notes: form.get("notes") ?? "" }));
    }
    throw new ValidationError("Unknown action.");
  }, { message: op === "receive" ? "Goods received: stock and costs updated." : op === "place" ? "Purchase order placed." : "Purchase order cancelled." });
  if (result.ok) refresh();
  return result;
}
