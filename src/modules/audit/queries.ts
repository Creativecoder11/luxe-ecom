import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { assertCan, type StaffActor } from "@/modules/identity/actor";

export const AUDIT_PAGE_SIZE = 50;

export interface AuditFilters {
  entityType?: string;
  action?: string;
  page?: number;
}

export async function listAuditLogs(actor: StaffActor, filters: AuditFilters) {
  assertCan(actor, "audit.view");
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const where: Prisma.AuditLogWhereInput = {
    businessId: actor.businessId,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
  };
  const [rows, total, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where: { businessId: actor.businessId },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))];
  const users = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return {
    rows: rows.map((r) => ({ ...r, actor: r.actorId ? (userById.get(r.actorId) ?? null) : null })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    entityTypes: entityTypes.map((e) => e.entityType),
  };
}
