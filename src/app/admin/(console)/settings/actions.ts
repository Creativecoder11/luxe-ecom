"use server";

import { refresh, updateTag } from "next/cache";
import { formToObject, keepValues, runAction, type ActionResult } from "@/lib/actions";
import { STORE_POLICY_TAG } from "@/modules/content/storefront-data";
import { requireStaff } from "@/modules/identity/session";
import { deleteShippingZone, saveShippingZone, saveTaxClass, updateCommerceSettings } from "@/modules/settings/commerce.service";

/** Storefront shipping page and footer show delivery/COD settings. */
function settingsChanged() {
  updateTag(STORE_POLICY_TAG);
  refresh();
}

const bool = (form: FormData, key: string) => form.get(key) === "on" || form.get(key) === "true";

export async function saveCommerceSettingsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(
    () =>
      updateCommerceSettings(actor, {
        pricesIncludeTax: form.get("pricesIncludeTax") === "inclusive",
        vatRegistrationNumber: form.get("vatRegistrationNumber") ?? "",
        codEnabled: bool(form, "codEnabled"),
        codMaxOrder: form.get("codMaxOrder") ?? "",
        guestCheckoutEnabled: bool(form, "guestCheckoutEnabled"),
        lowStockThreshold: form.get("lowStockThreshold"),
      }),
    { message: "Settings saved. They apply to new orders immediately." },
  );
  if (result.ok) settingsChanged();
  return keepValues(result, form, ["vatRegistrationNumber", "codMaxOrder", "lowStockThreshold"]);
}

export async function saveTaxClassAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("taxClassId") ?? "") || null;
  const result = await runAction(
    () => saveTaxClass(actor, id, { name: form.get("name"), code: form.get("code"), ratePercent: form.get("ratePercent"), isDefault: bool(form, "isDefault") }),
    { message: "Tax class saved." },
  );
  if (result.ok) settingsChanged();
  return keepValues(result, form, ["name", "code", "ratePercent"]);
}

export async function saveShippingZoneAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("zoneId") ?? "") || null;
  const result = await runAction(
    () =>
      saveShippingZone(actor, id, {
        ...formToObject(form),
        districts: form.getAll("districts").map(String),
        isFallback: bool(form, "isFallback"),
        codEnabled: bool(form, "codEnabled"),
        isActive: bool(form, "isActive"),
      }),
    { message: "Delivery zone saved." },
  );
  if (result.ok) settingsChanged();
  return keepValues(result, form, ["name", "baseFee", "includedWeightGrams", "extraPerKg", "freeShippingThreshold", "codFee", "estimate", "sortOrder", "districts"]);
}

export async function deleteShippingZoneAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => deleteShippingZone(actor, String(form.get("zoneId"))), { message: "Delivery zone deleted." });
  if (result.ok) settingsChanged();
  return result;
}
