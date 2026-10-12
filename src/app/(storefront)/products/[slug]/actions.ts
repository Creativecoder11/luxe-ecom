"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getBusinessId } from "@/modules/business/context";
import { toggleWishlist } from "@/modules/cart/wishlist.service";
import { getCustomerUser } from "@/modules/identity/session";

export async function toggleWishlistAction(form: FormData) {
  const productId = String(form.get("productId") ?? "");
  const slug = String(form.get("slug") ?? "");
  const user = await getCustomerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
  await toggleWishlist(await getBusinessId(), user.id, productId);
  refresh();
}
