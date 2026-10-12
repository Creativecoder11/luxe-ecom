import type { PrismaClient } from "@/generated/prisma/client";
import { RateLimitedError } from "@/lib/errors";

export interface RateLimitRule {
  /** Bucket namespace, e.g. "login:ip". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginByIp: { name: "login:ip", limit: 30, windowSeconds: 15 * 60 },
  loginByEmail: { name: "login:email", limit: 8, windowSeconds: 15 * 60 },
  registerByIp: { name: "register:ip", limit: 10, windowSeconds: 60 * 60 },
  passwordResetByIp: { name: "reset:ip", limit: 10, windowSeconds: 60 * 60 },
  passwordResetByEmail: { name: "reset:email", limit: 3, windowSeconds: 60 * 60 },
  checkoutByIp: { name: "checkout:ip", limit: 20, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Atomic fixed-window counter in PostgreSQL (shared across instances).
 * Throws RateLimitedError once `limit` hits are exceeded within the window.
 */
export async function consumeRateLimit(db: PrismaClient, rule: RateLimitRule, subject: string): Promise<void> {
  const key = `${rule.name}:${subject.toLowerCase()}`.slice(0, 300);
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}) THEN 1
        ELSE "rate_limit_buckets"."count" + 1 END,
      "windowStart" = CASE
        WHEN "rate_limit_buckets"."windowStart" <= now() - make_interval(secs => ${rule.windowSeconds}) THEN now()
        ELSE "rate_limit_buckets"."windowStart" END
    RETURNING "count", "windowStart"`;
  const row = rows[0];
  if (row && row.count > rule.limit) {
    const elapsed = (Date.now() - row.windowStart.getTime()) / 1000;
    throw new RateLimitedError(Math.max(1, Math.ceil(rule.windowSeconds - elapsed)));
  }
}
