import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const CART_COOKIE = "ucp_cart";

export async function readCartToken(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && /^[A-Za-z0-9_-]{20,64}$/.test(value) ? value : null;
}

/** httpOnly, SameSite=Lax, 60 days; Secure outside development. Only callable from server actions/route handlers. */
export async function writeCartToken(token: string) {
  const { APP_ENV } = env();
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: APP_ENV === "production" || APP_ENV === "staging",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}
