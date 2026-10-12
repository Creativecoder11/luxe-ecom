"use server";

import { updateTag } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions";
import { ValidationError } from "@/lib/errors";
import { CSV_MAX_BYTES, importProductsCsv, type ImportReport } from "@/modules/catalog/csv";
import { CATALOG_TAG } from "@/modules/catalog/storefront";
import { requireStaff } from "@/modules/identity/session";

export async function importProductsAction(_prev: ActionResult<ImportReport> | null, form: FormData): Promise<ActionResult<ImportReport>> {
  const actor = await requireStaff();
  const apply = form.get("mode") === "apply";
  const result = await runAction(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a CSV file.", { file: "Choose a CSV file" });
    if (file.size > CSV_MAX_BYTES) throw new ValidationError("The file is too large (limit 900 KB, about 2,000 rows).", { file: "File too large" });
    if (!/\.csv$/i.test(file.name)) throw new ValidationError("Upload a .csv file.", { file: "Upload a .csv file" });
    return importProductsCsv(actor, await file.text(), { apply });
  });
  if (result.ok && result.data?.applied) updateTag(CATALOG_TAG);
  return result;
}
