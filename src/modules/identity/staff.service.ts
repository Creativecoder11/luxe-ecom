import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { normalizeBdMobile } from "@/lib/phone";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, isOwner, type StaffActor } from "./actor";
import { OWNER_ROLE_KEY } from "./permissions";

/** 16 random bytes → 22 url-safe characters; shown once to the admin who created/reset the account. */
export function generateTemporaryPassword(): string {
  return randomBytes(16).toString("base64url");
}

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name").max(120),
  email: z.email("Enter a valid email address").trim().toLowerCase().max(254),
  phone: z.string().trim().max(30).optional().default(""),
  jobTitle: z.string().trim().max(80).optional().default(""),
  roleId: z.string().min(1, "Choose a role"),
});

export async function listStaff(actor: StaffActor) {
  assertCan(actor, "staff.view");
  return db.staffMember.findMany({
    where: { businessId: actor.businessId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      role: { select: { id: true, key: true, name: true } },
      user: { select: { id: true, name: true, email: true, phone: true, mustChangePassword: true, createdAt: true } },
    },
  });
}

async function getAssignableRole(actor: StaffActor, roleId: string) {
  const role = await db.role.findFirst({ where: { id: roleId, businessId: actor.businessId } });
  if (!role) throw new ValidationError("Choose a valid role.", { roleId: "Choose a valid role" });
  if (role.key === OWNER_ROLE_KEY && !isOwner(actor)) {
    throw new ForbiddenError("staff.manage");
  }
  return role;
}

export async function createStaff(actor: StaffActor, raw: unknown) {
  assertCan(actor, "staff.manage");
  const input = createStaffSchema.parse(raw);
  let phone: string | null = null;
  if (input.phone) {
    const parsed = normalizeBdMobile(input.phone);
    if (!parsed.ok) throw new ValidationError("Enter a valid Bangladesh mobile number.", { phone: "Enter a valid Bangladesh mobile number" });
    phone = parsed.e164;
  }
  const role = await getAssignableRole(actor, input.roleId);

  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new ConflictError("An account with this email already exists.");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const userId = randomUUID();

  const staff = await db.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, name: input.name, email: input.email, phone, kind: "STAFF", mustChangePassword: true, emailVerified: false },
    });
    await tx.account.create({
      data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash },
    });
    const member = await tx.staffMember.create({
      data: {
        businessId: actor.businessId,
        userId,
        roleId: role.id,
        jobTitle: input.jobTitle || null,
        createdById: actor.userId,
      },
    });
    await recordAudit(tx, actor, {
      action: "staff.created",
      entityType: "StaffMember",
      entityId: member.id,
      after: { name: input.name, email: input.email, role: role.key, jobTitle: input.jobTitle || null },
    });
    return member;
  });

  return { staffId: staff.id, temporaryPassword };
}

async function getStaffInBusiness(actor: StaffActor, staffId: string) {
  const staff = await db.staffMember.findFirst({
    where: { id: staffId, businessId: actor.businessId },
    include: { role: true, user: true },
  });
  if (!staff) throw new NotFoundError("Staff member");
  return staff;
}

async function assertAnotherActiveOwner(businessId: string, excludingStaffId: string) {
  const owners = await db.staffMember.count({
    where: { businessId, status: "ACTIVE", role: { key: OWNER_ROLE_KEY }, id: { not: excludingStaffId } },
  });
  if (owners === 0) throw new ConflictError("The business must keep at least one active owner.");
}

export async function changeStaffRole(actor: StaffActor, staffId: string, roleId: string) {
  assertCan(actor, "staff.manage");
  const staff = await getStaffInBusiness(actor, staffId);
  if (staff.id === actor.staffId) throw new ConflictError("You cannot change your own role.");
  if (staff.role.key === OWNER_ROLE_KEY && !isOwner(actor)) throw new ForbiddenError("staff.manage");
  const role = await getAssignableRole(actor, roleId);
  if (role.id === staff.roleId) return;
  if (staff.role.key === OWNER_ROLE_KEY) await assertAnotherActiveOwner(actor.businessId, staff.id);

  await db.$transaction(async (tx) => {
    await tx.staffMember.update({ where: { id: staff.id }, data: { roleId: role.id } });
    await recordAudit(tx, actor, {
      action: "staff.role_changed",
      entityType: "StaffMember",
      entityId: staff.id,
      before: { role: staff.role.key },
      after: { role: role.key },
    });
  });
}

export async function setStaffStatus(actor: StaffActor, staffId: string, status: "ACTIVE" | "SUSPENDED", reason?: string) {
  assertCan(actor, "staff.manage");
  const staff = await getStaffInBusiness(actor, staffId);
  if (staff.id === actor.staffId) throw new ConflictError("You cannot suspend your own account.");
  if (staff.role.key === OWNER_ROLE_KEY && !isOwner(actor)) throw new ForbiddenError("staff.manage");
  if (staff.status === status) return;
  if (status === "SUSPENDED" && staff.role.key === OWNER_ROLE_KEY) await assertAnotherActiveOwner(actor.businessId, staff.id);

  await db.$transaction(async (tx) => {
    await tx.staffMember.update({ where: { id: staff.id }, data: { status } });
    await tx.user.update({ where: { id: staff.userId }, data: { status: status === "ACTIVE" ? "ACTIVE" : "DISABLED" } });
    // Suspension takes effect immediately: every open session is revoked.
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: staff.userId } });
    await recordAudit(tx, actor, {
      action: status === "SUSPENDED" ? "staff.suspended" : "staff.reactivated",
      entityType: "StaffMember",
      entityId: staff.id,
      before: { status: staff.status },
      after: { status },
      reason: reason || null,
    });
  });
}

/** Issues a new temporary password (no email provider yet), forces a change and revokes sessions. */
export async function resetStaffPassword(actor: StaffActor, staffId: string) {
  assertCan(actor, "staff.manage");
  const staff = await getStaffInBusiness(actor, staffId);
  if (staff.id === actor.staffId) throw new ConflictError("Use “Change password” for your own account.");
  if (staff.role.key === OWNER_ROLE_KEY && !isOwner(actor)) throw new ForbiddenError("staff.manage");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    const updated = await tx.account.updateMany({
      where: { userId: staff.userId, providerId: "credential" },
      data: { password: passwordHash },
    });
    if (updated.count !== 1) throw new ConflictError("This account has no password sign-in.");
    await tx.user.update({ where: { id: staff.userId }, data: { mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId: staff.userId } });
    await recordAudit(tx, actor, { action: "staff.password_reset", entityType: "StaffMember", entityId: staff.id });
  });
  return { temporaryPassword };
}
