"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { keepValues, runAction, type ActionResult } from "@/lib/actions";
import { ValidationError } from "@/lib/errors";
import { archiveAttribute, createAttribute, updateAttribute } from "@/modules/catalog/attribute.service";
import { createBrand, deleteBrand, updateBrand } from "@/modules/catalog/brand.service";
import { createCategory, deleteCategory, updateCategory } from "@/modules/catalog/category.service";
import {
  archiveProduct,
  bulkProductAction,
  createProduct,
  deleteDraftProduct,
  duplicateProduct,
  publishProduct,
  restoreProduct,
  unpublishProduct,
  updateProduct,
} from "@/modules/catalog/product.service";
import { deleteMedia, moveMedia, updateMediaAlt } from "@/modules/catalog/media.service";
import { CATALOG_TAG } from "@/modules/catalog/storefront";
import { requireStaff } from "@/modules/identity/session";

/** Complex editors submit a JSON payload in a hidden field. */
function readPayload(form: FormData): unknown {
  const raw = form.get("payload");
  if (typeof raw !== "string" || raw.length > 500_000) throw new ValidationError("The form data was incomplete. Please try again.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("The form data was incomplete. Please try again.");
  }
}

function invalidateCatalog() {
  // Storefront listings, product pages, navigation and sitemap read through the "catalog" cache tag.
  updateTag(CATALOG_TAG);
}

// ---------- Products ----------

export async function saveProductAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const productId = form.get("productId");
  if (typeof productId === "string" && productId) {
    const result = await runAction(() => updateProduct(actor, productId, readPayload(form)), { message: "Product saved." });
    if (result.ok) {
      invalidateCatalog();
      refresh();
    }
    return result.ok ? { ok: true, message: result.message } : result;
  }
  const result = await runAction(() => createProduct(actor, readPayload(form)));
  if (result.ok && result.data) {
    invalidateCatalog();
    redirect(`/admin/catalog/products/${result.data.id}?created=1`);
  }
  return result.ok ? { ok: true } : result;
}

const lifecycleActions = {
  publish: publishProduct,
  unpublish: unpublishProduct,
  archive: archiveProduct,
  restore: restoreProduct,
} as const;

export async function productLifecycleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const productId = String(form.get("productId") ?? "");
  const action = String(form.get("action") ?? "");
  if (action === "duplicate") {
    const result = await runAction(() => duplicateProduct(actor, productId));
    if (result.ok && result.data) redirect(`/admin/catalog/products/${result.data.id}?duplicated=1`);
    return result.ok ? { ok: true } : result;
  }
  if (action === "delete") {
    const result = await runAction(() => deleteDraftProduct(actor, productId));
    if (result.ok) {
      invalidateCatalog();
      redirect("/admin/catalog/products?deleted=1");
    }
    return result;
  }
  const run = lifecycleActions[action as keyof typeof lifecycleActions];
  if (!run) return { ok: false, error: "Unknown action." };
  const labels = { publish: "Published.", unpublish: "Unpublished: now hidden from the store.", archive: "Archived.", restore: "Restored as a draft." };
  const result = await runAction(() => run(actor, productId), { message: labels[action as keyof typeof labels] });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

export async function bulkProductsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const action = z.enum(["publish", "unpublish", "archive"]).safeParse(form.get("bulkAction"));
  const ids = form.getAll("productIds").map(String);
  if (!action.success) return { ok: false, error: "Choose a bulk action." };
  if (ids.length === 0) return { ok: false, error: "Select at least one product." };
  const result = await runAction(() => bulkProductAction(actor, ids, action.data));
  if (!result.ok || !result.data) return result.ok ? { ok: true } : result;
  invalidateCatalog();
  refresh();
  const { succeeded, failures } = result.data;
  if (failures.length) {
    return { ok: false, error: `${succeeded} updated, ${failures.length} not updated: ${failures.map((f) => f.error).join(" ")}` };
  }
  return { ok: true, message: `${succeeded} product${succeeded === 1 ? "" : "s"} updated.` };
}

// ---------- Categories ----------

export async function saveCategoryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("categoryId") ?? "");
  const payload = () => readPayload(form);
  const result = id
    ? await runAction(() => updateCategory(actor, id, payload()), { message: "Category saved." })
    : await runAction(async () => void (await createCategory(actor, payload())), { message: "Category created." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

export async function deleteCategoryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => deleteCategory(actor, String(form.get("categoryId"))), { message: "Category deleted." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

// ---------- Attributes ----------

export async function saveAttributeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("attributeId") ?? "");
  const payload = () => readPayload(form);
  const result = id
    ? await runAction(() => updateAttribute(actor, id, payload()), { message: "Attribute saved." })
    : await runAction(async () => void (await createAttribute(actor, payload())), { message: "Attribute created." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

export async function archiveAttributeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => archiveAttribute(actor, String(form.get("attributeId"))), { message: "Attribute archived." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

// ---------- Brands ----------

export async function saveBrandAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(form.get("brandId") ?? "");
  const input = { name: form.get("name"), slug: form.get("slug") ?? "", description: form.get("description") ?? "", status: form.get("status") ?? "ACTIVE" };
  const result = id
    ? await runAction(() => updateBrand(actor, id, input), { message: "Brand saved." })
    : await runAction(async () => void (await createBrand(actor, input)), { message: "Brand created." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return keepValues(result, form, ["name", "slug", "description", "status"]);
}

export async function deleteBrandAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const result = await runAction(() => deleteBrand(actor, String(form.get("brandId"))), { message: "Brand deleted." });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}

// ---------- Product images ----------

export async function mediaAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const mediaId = String(form.get("mediaId") ?? "");
  const op = String(form.get("op") ?? "");
  const result = await runAction(async () => {
    if (op === "alt") await updateMediaAlt(actor, mediaId, String(form.get("alt") ?? ""));
    else if (op === "up" || op === "down") await moveMedia(actor, mediaId, op);
    else if (op === "delete") await deleteMedia(actor, mediaId);
    else throw new ValidationError("Unknown image action.");
  });
  if (result.ok) {
    invalidateCatalog();
    refresh();
  }
  return result;
}
