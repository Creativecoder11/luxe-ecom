import type { Prisma } from "@/generated/prisma/client";
import { actorAuditFields, type Actor } from "@/modules/identity/actor";

type Tx = Prisma.TransactionClient;

const SENSITIVE_KEYS = /password|secret|token|hash|apikey|authorization|cookie/i;

/** Removes credential-like fields from audit snapshots. PII stays (audit access is permission-gated). */
export function redactForAudit(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  // A missing snapshot is stored as SQL NULL; nested nulls are kept as JSON null below.
  if (value === undefined || value === null) return undefined;
  if (depth > 6) return "[truncated]";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redactForAudit(v, depth + 1) ?? null) as Prisma.InputJsonValue;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : (redactForAudit(v, depth + 1) ?? null);
    }
    return out as Prisma.InputJsonValue;
  }
  if (typeof value === "bigint") return value.toString();
  return value as Prisma.InputJsonValue;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Writes an audit record inside the caller's transaction, so the change and its record commit together. */
export async function recordAudit(tx: Tx, actor: Actor, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      businessId: actor.businessId,
      ...actorAuditFields(actor),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: redactForAudit(entry.before),
      after: redactForAudit(entry.after),
      reason: entry.reason ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent?.slice(0, 500) ?? null,
    },
  });
}
