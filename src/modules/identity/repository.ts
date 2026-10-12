import type { PrismaClient } from "@/generated/prisma/client";
import type { StaffActor } from "./actor";
import { ALL_PERMISSIONS, OWNER_ROLE_KEY, sanitizePermissions, type Permission } from "./permissions";

/**
 * Resolves an active staff actor for a user, or null when the user is not active staff.
 * Permissions come from the role at request time, so role edits apply immediately.
 */
export async function loadStaffActor(db: PrismaClient, userId: string): Promise<StaffActor | null> {
  const staff = await db.staffMember.findUnique({
    where: { userId },
    include: { role: true, user: { select: { name: true, email: true, status: true, kind: true } } },
  });
  if (!staff || staff.status !== "ACTIVE") return null;
  if (staff.user.status !== "ACTIVE" || staff.user.kind !== "STAFF") return null;

  // Owners always hold the full, current catalog, so newly added permissions need no data migration.
  const permissions: readonly Permission[] =
    staff.role.key === OWNER_ROLE_KEY ? ALL_PERMISSIONS : sanitizePermissions(staff.role.permissions);

  return {
    kind: "staff",
    userId,
    staffId: staff.id,
    businessId: staff.businessId,
    name: staff.user.name,
    email: staff.user.email,
    roleKey: staff.role.key,
    roleName: staff.role.name,
    permissions: new Set(permissions),
  };
}
