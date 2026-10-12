import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, isOwner, type StaffActor } from "./actor";
import { OWNER_ROLE_KEY, sanitizePermissions, type Permission } from "./permissions";

export const roleInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(60),
  description: z.string().trim().max(200).optional().default(""),
  permissions: z.array(z.string()).default([]),
});

export function roleKeyFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function listRoles(actor: StaffActor) {
  assertCan(actor, "staff.view");
  return db.role.findMany({
    where: { businessId: actor.businessId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { staff: true } } },
  });
}

export async function getRole(actor: StaffActor, roleId: string) {
  assertCan(actor, "staff.view");
  const role = await db.role.findFirst({
    where: { id: roleId, businessId: actor.businessId },
    include: { _count: { select: { staff: true } } },
  });
  if (!role) throw new NotFoundError("Role");
  return role;
}

/** Prevents privilege escalation: a non-owner can only grant permissions they hold themselves. */
function assertCanGrant(actor: StaffActor, permissions: readonly Permission[]) {
  if (isOwner(actor)) return;
  const missing = permissions.filter((p) => !actor.permissions.has(p));
  if (missing.length > 0) {
    throw new ValidationError(`You cannot grant permissions you do not hold: ${missing.join(", ")}.`);
  }
}

export async function createRole(actor: StaffActor, raw: unknown) {
  assertCan(actor, "roles.manage");
  const input = roleInputSchema.parse(raw);
  const permissions = sanitizePermissions(input.permissions);
  assertCanGrant(actor, permissions);
  const key = roleKeyFromName(input.name);
  if (!key || key === OWNER_ROLE_KEY) throw new ValidationError("Choose a different role name.", { name: "Choose a different name" });
  const clash = await db.role.findUnique({ where: { businessId_key: { businessId: actor.businessId, key } } });
  if (clash) throw new ConflictError("A role with a similar name already exists.");

  return db.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { businessId: actor.businessId, key, name: input.name, description: input.description || null, permissions },
    });
    await recordAudit(tx, actor, { action: "role.created", entityType: "Role", entityId: role.id, after: { key, permissions } });
    return role;
  });
}

export async function updateRole(actor: StaffActor, roleId: string, raw: unknown) {
  assertCan(actor, "roles.manage");
  const role = await getRole(actor, roleId);
  if (role.key === OWNER_ROLE_KEY) throw new ForbiddenError("roles.manage");
  const input = roleInputSchema.parse(raw);
  const permissions = sanitizePermissions(input.permissions);
  // Only newly added permissions need to be held by the editor; removing is always allowed.
  assertCanGrant(actor, permissions.filter((p) => !role.permissions.includes(p)));

  await db.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: role.id },
      data: { name: input.name, description: input.description || null, permissions },
    });
    await recordAudit(tx, actor, {
      action: "role.updated",
      entityType: "Role",
      entityId: role.id,
      before: { name: role.name, permissions: role.permissions },
      after: { name: input.name, permissions },
    });
  });
}

export async function deleteRole(actor: StaffActor, roleId: string) {
  assertCan(actor, "roles.manage");
  const role = await getRole(actor, roleId);
  if (role.isSystem) throw new ConflictError("System roles cannot be deleted.");
  const assigned = await db.staffMember.count({ where: { roleId: role.id } });
  if (assigned > 0) throw new ConflictError("Reassign the staff members using this role first.");
  await db.$transaction(async (tx) => {
    await tx.role.delete({ where: { id: role.id } });
    await recordAudit(tx, actor, { action: "role.deleted", entityType: "Role", entityId: role.id, before: { key: role.key } });
  });
}
