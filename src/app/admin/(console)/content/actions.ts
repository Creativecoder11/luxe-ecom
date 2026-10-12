"use server";

import { refresh, updateTag } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions";
import { CONTENT_TAG, updateHomepageSection } from "@/modules/content/content.service";
import { CONTENT_SECTIONS, type ContentSection } from "@/modules/content/schema";
import { requireStaff } from "@/modules/identity/session";

export async function saveContentSectionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const section = String(form.get("section") ?? "") as ContentSection;
  const result = await runAction(
    async () => {
      if (!CONTENT_SECTIONS.includes(section)) throw new Error(`Unknown content section: ${section}`);
      await updateHomepageSection(actor, section, (name) => {
        const value = form.get(name);
        return typeof value === "string" ? value : "";
      });
    },
    { message: "Saved. The storefront shows the change now." },
  );
  if (result.ok) {
    updateTag(CONTENT_TAG);
    refresh();
  }
  return result;
}
