import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@/generated/prisma/client";
import { ALL_PERMISSIONS, OWNER_ROLE_KEY, SYSTEM_ROLES } from "./permissions";

/**
 * Creates missing system roles. Existing roles keep their (possibly owner-edited) permissions;
 * only the owner role is always reset to the full catalog.
 */
export async function ensureSystemRoles(db: PrismaClient, businessId: string) {
  for (const role of SYSTEM_ROLES) {
    await db.role.upsert({
      where: { businessId_key: { businessId, key: role.key } },
      create: {
        businessId,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
        permissions: [...role.permissions],
      },
      update: role.key === OWNER_ROLE_KEY ? { permissions: [...ALL_PERMISSIONS], isSystem: true } : { isSystem: true },
    });
  }
}

export interface OwnerInput {
  email: string;
  name: string;
  password: string;
  mustChangePassword: boolean;
}

/** Creates the first owner account. Refuses if the email is already registered. */
export async function createOwner(db: PrismaClient, businessId: string, input: OwnerInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { created: false as const, userId: existing.id };

  const ownerRole = await db.role.findUniqueOrThrow({ where: { businessId_key: { businessId, key: OWNER_ROLE_KEY } } });
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, email, name: input.name, kind: "STAFF", mustChangePassword: input.mustChangePassword },
    });
    await tx.account.create({ data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash } });
    const staff = await tx.staffMember.create({ data: { businessId, userId, roleId: ownerRole.id } });
    await tx.auditLog.create({
      data: { businessId, actorType: "SYSTEM", action: "staff.owner_bootstrapped", entityType: "StaffMember", entityId: staff.id, after: { email } },
    });
  });
  return { created: true as const, userId };
}
