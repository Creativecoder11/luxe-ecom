"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { getBusinessId } from "@/modules/business/context";
import { readCartToken, writeCartToken } from "@/modules/cart/cart-cookie";
import { applyCartCoupon, getOrCreateCart, removeCartCoupon, setCartQuantity } from "@/modules/cart/cart.service";
import { getMiniCart, type MiniCart } from "@/modules/cart/mini-cart";
import { getCustomerUser } from "@/modules/identity/session";

async function currentCart() {
  const [businessId, token, user] = await Promise.all([getBusinessId(), readCartToken(), getCustomerUser()]);
  const cart = await getOrCreateCart(businessId, token, user?.id ?? null);
  if (cart.token !== token) await writeCartToken(cart.token);
  return { businessId, cart };
}

const lineSchema = z.object({ variantId: z.string().min(1), quantity: z.coerce.number().int().min(0).max(99) });

/** Adds to the cart and returns the updated mini cart, so the drawer opens without another request. */
export async function addToCartAction(_prev: ActionResult<MiniCart> | null, form: FormData): Promise<ActionResult<MiniCart>> {
  const result = await runAction(
    async () => {
      const input = lineSchema.parse({ variantId: form.get("variantId"), quantity: form.get("quantity") ?? 1 });
      const { businessId, cart } = await currentCart();
      await setCartQuantity(businessId, cart.id, input.variantId, Math.max(1, input.quantity), "add");
      return getMiniCart(businessId, cart.token);
    },
    { message: "Added to your cart." },
  );
  if (result.ok) refresh();
  return result;
}

/** Current cart for the drawer (opened from the header). Never creates a cart. */
export async function getMiniCartAction(): Promise<MiniCart> {
  const [businessId, token] = await Promise.all([getBusinessId(), readCartToken()]);
  return getMiniCart(businessId, token);
}

/** Removes a line from the drawer and returns the updated mini cart. */
export async function removeMiniCartLineAction(variantId: string): Promise<ActionResult<MiniCart>> {
  const result = await runAction(async () => {
    const id = z.string().min(1).max(64).parse(variantId);
    const { businessId, cart } = await currentCart();
    await setCartQuantity(businessId, cart.id, id, 0, "set");
    return getMiniCart(businessId, cart.token);
  });
  if (result.ok) refresh();
  return result;
}

export async function updateCartLineAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const input = lineSchema.parse({ variantId: form.get("variantId"), quantity: form.get("quantity") });
    const { businessId, cart } = await currentCart();
    await setCartQuantity(businessId, cart.id, input.variantId, input.quantity, "set");
  });
  if (result.ok) refresh();
  return result;
}

export async function applyCouponAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await runAction(
    async () => {
      const { businessId, cart } = await currentCart();
      await applyCartCoupon(businessId, cart.id, String(form.get("code") ?? ""));
    },
    { message: "Coupon applied." },
  );
  if (result.ok) refresh();
  return result;
}

export async function removeCouponAction(): Promise<void> {
  const { cart } = await currentCart();
  await removeCartCoupon(cart.id);
  refresh();
}
