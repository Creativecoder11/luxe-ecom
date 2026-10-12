import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { siteConfig } from "@/config/site";
import { getEmailSender } from "@/integrations/email";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { hashPassword, verifyPassword } from "./password";

/**
 * Better Auth (D-003). Used only server-side through `auth.api.*` from server actions;
 * the public HTTP handler is intentionally not mounted (D-023), so rate limiting is done
 * by the app (src/lib/security/rate-limit.ts) before each auth call.
 */
export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env().APP_URL,
  secret: env().AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    password: { hash: hashPassword, verify: verifyPassword },
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const result = await getEmailSender().send({
        to: user.email,
        subject: `Reset your ${siteConfig.name} password`,
        text: `Use this link within one hour to choose a new password:\n\n${resetUrl}\n\nIf you did not ask for this, ignore this email.`,
      });
      if (result.status === "SENT") return;
      if (env().APP_ENV === "development" || env().APP_ENV === "test") {
        // Development only: no provider is configured, so the link is NOT emailed. It is logged for local testing.
        logger.warn({ devResetLink: resetUrl, reason: result.reason }, "password reset email NOT sent (development link logged)");
      } else {
        logger.error({ reason: result.reason }, "password reset email NOT sent: no email provider configured");
      }
    },
  },
  user: {
    additionalFields: {
      kind: { type: "string", input: false, defaultValue: "CUSTOMER" },
      status: { type: "string", input: false, defaultValue: "ACTIVE" },
      phone: { type: "string", input: false, required: false },
      mustChangePassword: { type: "boolean", input: false, defaultValue: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: { enabled: false },
  advanced: {
    cookiePrefix: "ucp",
    useSecureCookies: env().APP_ENV === "production" || env().APP_ENV === "staging",
  },
  databaseHooks: {
    session: {
      create: {
        // Disabled users cannot obtain a session, whatever the credential check said.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (!user || user.status !== "ACTIVE") return false;
        },
      },
    },
  },
  telemetry: { enabled: false },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
