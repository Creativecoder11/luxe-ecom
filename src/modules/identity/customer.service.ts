import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ValidationError } from "@/lib/errors";
import { normalizeBdMobile } from "@/lib/phone";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z.string().trim().min(1, "Enter your mobile number"),
});

/** Customers may only update their own profile: the user id comes from the session, never the form. */
export async function updateCustomerProfile(userId: string, raw: unknown) {
  const input = profileSchema.parse(raw);
  const phone = normalizeBdMobile(input.phone);
  if (!phone.ok) throw new ValidationError("Enter a valid Bangladesh mobile number.", { phone: "Enter a valid Bangladesh mobile number" });
  await db.user.update({ where: { id: userId, kind: "CUSTOMER" }, data: { name: input.name, phone: phone.e164 } });
}
