import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { DEFAULT_BUSINESS_SLUG } from "@/config/business";
import type { StaffActor } from "@/modules/identity/actor";
import { ensureCatalogDefaults } from "@/modules/catalog/defaults";
import { ensureSystemRoles } from "@/modules/identity/bootstrap";
import { loadStaffActor } from "@/modules/identity/repository";

export { db };

/** Empties every application table (TRUNCATE bypasses the audit log's row triggers). */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function createBusiness() {
  const business = await db.business.create({
    data: { slug: DEFAULT_BUSINESS_SLUG, name: "Test Business", settings: { create: { storeName: "Test Store" } } },
  });
  await ensureSystemRoles(db, business.id);
  await ensureCatalogDefaults(db, business.id);
  return business;
}

/** Creates an active staff member with the given role and returns their resolved actor. */
export async function createStaffActor(businessId: string, roleKey: string, email = `${roleKey}-${randomUUID()}@example.test`): Promise<StaffActor> {
  const role = await db.role.findUniqueOrThrow({ where: { businessId_key: { businessId, key: roleKey } } });
  const user = await db.user.create({ data: { id: randomUUID(), email, name: `Test ${roleKey}`, kind: "STAFF" } });
  await db.staffMember.create({ data: { businessId, userId: user.id, roleId: role.id } });
  const actor = await loadStaffActor(db, user.id);
  if (!actor) throw new Error("failed to create staff actor");
  return actor;
}
