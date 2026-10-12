import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { __ucpDb?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Single PrismaClient per process (reused across dev hot reloads). Only module services may import this. */
export const db: PrismaClient = globalForDb.__ucpDb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__ucpDb = db;
}

/**
 * Interactive-transaction budget for multi-step business writes (checkout, goods receipt,
 * product saves). Prisma's 5 s default is too tight when the server is under load; failing a
 * customer's order because the box was busy is worse than waiting a little longer.
 */
export const HEAVY_TRANSACTION = { maxWait: 10_000, timeout: 20_000 } as const;
