"use server";

import { refresh } from "next/cache";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { requireStaff } from "@/modules/identity/session";
import { adjustStock } from "@/modules/inventory/inventory.service";

export async function adjustStockAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(async () => {
    const r = await adjustStock(actor, formToObject(form));
    return r;
  });
  if (!result.ok) return keepValues({ ...result }, form, ["quantity", "reason", "note"]);
  refresh();
  return { ok: true, message: `Stock updated: ${result.data!.onHand} on hand.` };
}
