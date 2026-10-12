import "server-only";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { DomainError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { normalizeBdMobile } from "@/lib/phone";
import { getRequestMeta } from "@/lib/request";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { recordAudit } from "@/modules/audit/service";
import { loadStaffActor } from "./repository";

const INVALID_CREDENTIALS = "Incorrect email or password.";

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters");

export const signInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password").max(128),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: z.email("Enter a valid email address").trim().toLowerCase().max(254),
    phone: z.string().trim().min(1, "Enter your mobile number"),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });

export const resetPasswordSchema = z
  .object({ token: z.string().min(1), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

async function limitSignIn(email: string) {
  const { ip } = await getRequestMeta();
  await consumeRateLimit(db, RATE_LIMITS.loginByIp, ip);
  await consumeRateLimit(db, RATE_LIMITS.loginByEmail, email);
}

async function signInWithPassword(email: string, pw: string): Promise<string> {
  try {
    const result = await auth.api.signInEmail({ body: { email, password: pw, rememberMe: true }, headers: await headers() });
    return result.user.id;
  } catch (error) {
    if (error instanceof APIError) throw new DomainError(INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
    throw error;
  }
}

/** Staff sign-in: only active staff with an active staff record may sign in here. */
export async function signInStaff(raw: unknown) {
  const input = signInSchema.parse(raw);
  await limitSignIn(input.email);
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, kind: true } });
  // Same message for unknown, customer and suspended accounts: no account enumeration.
  if (!user || user.kind !== "STAFF" || !(await loadStaffActor(db, user.id))) {
    throw new DomainError(INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
  }
  await signInWithPassword(input.email, input.password);
  const actor = await loadStaffActor(db, user.id);
  if (actor) {
    const meta = await getRequestMeta();
    await db.$transaction((tx) =>
      recordAudit(tx, actor, { action: "staff.signed_in", entityType: "User", entityId: user.id, ipAddress: meta.ip, userAgent: meta.userAgent }),
    );
  }
}

/** Returns the signed-in user's id (used to merge the guest cart). */
export async function signInCustomer(raw: unknown): Promise<string> {
  const input = signInSchema.parse(raw);
  await limitSignIn(input.email);
  const user = await db.user.findUnique({ where: { email: input.email }, select: { kind: true } });
  if (user && user.kind !== "CUSTOMER") throw new DomainError(INVALID_CREDENTIALS, "INVALID_CREDENTIALS");
  return signInWithPassword(input.email, input.password);
}

/** Returns the new user's id (used to merge the guest cart). */
export async function registerCustomer(raw: unknown): Promise<string> {
  const input = registerSchema.parse(raw);
  const phone = normalizeBdMobile(input.phone);
  if (!phone.ok) throw new ValidationError("Enter a valid Bangladesh mobile number.", { phone: "Enter a valid Bangladesh mobile number (e.g. 01712345678)" });
  const { ip } = await getRequestMeta();
  await consumeRateLimit(db, RATE_LIMITS.registerByIp, ip);

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      throw new ValidationError("We could not create an account with this email. If you already have one, sign in or reset your password.", {
        email: "This email cannot be used to register",
      });
    }
    throw error;
  }
  await db.user.update({ where: { id: userId }, data: { phone: phone.e164 } });
  return userId;
}

/** Always resolves the same way whether or not the email exists (no enumeration). */
export async function requestPasswordReset(raw: unknown) {
  const { email } = z.object({ email: z.email("Enter a valid email address").trim().toLowerCase() }).parse(raw);
  const { ip } = await getRequestMeta();
  await consumeRateLimit(db, RATE_LIMITS.passwordResetByIp, ip);
  await consumeRateLimit(db, RATE_LIMITS.passwordResetByEmail, email);
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
  } catch (error) {
    unstable_rethrow(error);
    logger.warn({ err: error }, "password reset request failed");
  }
}

export async function resetPassword(raw: unknown) {
  const input = resetPasswordSchema.parse(raw);
  try {
    await auth.api.resetPassword({ body: { token: input.token, newPassword: input.newPassword }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) throw new DomainError("This reset link is invalid or has expired. Request a new one.", "INVALID_TOKEN");
    throw error;
  }
}

/** Changes the signed-in user's password, revokes their other sessions and clears a forced-change flag. */
export async function changeOwnPassword(userId: string, raw: unknown) {
  const input = changePasswordSchema.parse(raw);
  try {
    await auth.api.changePassword({
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw new ValidationError("Your current password is incorrect.", { currentPassword: "Incorrect password" });
    }
    throw error;
  }
  const user = await db.user.update({ where: { id: userId }, data: { mustChangePassword: false }, select: { kind: true } });
  const staffActor = user.kind === "STAFF" ? await loadStaffActor(db, userId) : null;
  if (staffActor) {
    await db.$transaction((tx) =>
      recordAudit(tx, staffActor, { action: "user.password_changed", entityType: "User", entityId: userId }),
    );
  }
}

export async function signOut() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    unstable_rethrow(error);
    logger.warn({ err: error }, "sign-out failed");
  }
}
