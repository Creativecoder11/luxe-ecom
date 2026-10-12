"use server";

import { keepValues, runAction, type ActionResult } from "@/lib/actions";
import { getRequestMeta } from "@/lib/request";
import { subscribeToNewsletter } from "@/modules/content/content.service";

export async function subscribeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(
    async () => {
      const { ip } = await getRequestMeta();
      // The same reply for new and existing addresses, so the form cannot be used to look up subscribers.
      await subscribeToNewsletter(String(form.get("email") ?? ""), ip);
    },
    { message: "Thanks, you are on the list. We only email once our mailing service is set up." },
  );
  return keepValues(result, form, ["email"]);
}
