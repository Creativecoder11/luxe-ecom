import "server-only";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import type { StaffActor } from "./actor";
import { loadStaffActor } from "./repository";

/** The current session (validated against the database), memoized per request. */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    // Never swallow Next.js control flow (prerender postponement, redirects): it must propagate.
    unstable_rethrow(error);
    logger.error({ err: error }, "session lookup failed");
    return null;
  }
});

export const getStaffActor = cache(async (): Promise<StaffActor | null> => {
  const session = await getSession();
  if (!session || session.user.kind !== "STAFF") return null;
  return loadStaffActor(db, session.user.id);
});

/**
 * For admin pages and actions: an active staff actor, or a redirect to staff sign-in.
 * Staff with a temporary password are sent to change it first.
 */
export async function requireStaff(options: { allowPasswordChange?: boolean } = {}): Promise<StaffActor> {
  const session = await getSession();
  const actor = await getStaffActor();
  if (!session || !actor) redirect("/admin/login");
  if (session.user.mustChangePassword && !options.allowPasswordChange) redirect("/admin/change-password");
  return actor;
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export const getCustomerUser = cache(async (): Promise<CustomerUser | null> => {
  const session = await getSession();
  if (!session || session.user.kind !== "CUSTOMER" || session.user.status !== "ACTIVE") return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    phone: (session.user.phone as string | null | undefined) ?? null,
  };
});

export async function requireCustomer(next = "/account"): Promise<CustomerUser> {
  const user = await getCustomerUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
