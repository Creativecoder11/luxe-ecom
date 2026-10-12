import { randomUUID } from "node:crypto";
import { verifyPassword } from "@/lib/auth/password";
import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, RateLimitedError, ValidationError } from "@/lib/errors";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import type { StaffActor } from "@/modules/identity/actor";
import { createOwner, ensureSystemRoles } from "@/modules/identity/bootstrap";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "@/modules/identity/permissions";
import { loadStaffActor } from "@/modules/identity/repository";
import { createRole, updateRole } from "@/modules/identity/roles.service";
import { changeStaffRole, createStaff, resetStaffPassword, setStaffStatus } from "@/modules/identity/staff.service";
import { createBusiness, createStaffActor, db, resetDatabase } from "../support/db";

let businessId: string;
let owner: StaffActor;

async function roleId(key: string) {
  return (await db.role.findUniqueOrThrow({ where: { businessId_key: { businessId, key } } })).id;
}

beforeEach(async () => {
  await resetDatabase();
  businessId = (await createBusiness()).id;
  owner = await createStaffActor(businessId, "owner");
});

describe("system roles and bootstrap", () => {
  it("creates every system role idempotently, owner resolves to all permissions", async () => {
    await ensureSystemRoles(db, businessId);
    expect(await db.role.count({ where: { businessId } })).toBe(SYSTEM_ROLES.length);
    expect(owner.permissions.size).toBe(ALL_PERMISSIONS.length);
  });

  it("does not overwrite owner-edited permissions of other system roles", async () => {
    await updateRole(owner, await roleId("crm_agent"), { name: "CRM agent", permissions: ["customers.view"] });
    await ensureSystemRoles(db, businessId);
    const role = await db.role.findUniqueOrThrow({ where: { id: await roleId("crm_agent") } });
    expect(role.permissions).toEqual(["customers.view"]);
  });

  it("bootstraps an owner with a working password hash", async () => {
    const result = await createOwner(db, businessId, { email: "Boss@Example.test", name: "Boss", password: "a-long-password-1", mustChangePassword: true });
    expect(result.created).toBe(true);
    const account = await db.account.findFirstOrThrow({ where: { userId: result.userId } });
    expect(await verifyPassword({ hash: account.password!, password: "a-long-password-1" })).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe("boss@example.test");
    expect(user.mustChangePassword).toBe(true);
  });
});

describe("staff management", () => {
  it("creates staff with a temporary password, forced change and an audit record", async () => {
    const { staffId, temporaryPassword } = await createStaff(owner, {
      name: "Rahim Uddin",
      email: "rahim@example.test",
      phone: "01712345678",
      roleId: await roleId("order_agent"),
    });
    const staff = await db.staffMember.findUniqueOrThrow({ where: { id: staffId }, include: { user: true } });
    expect(staff.user.kind).toBe("STAFF");
    expect(staff.user.mustChangePassword).toBe(true);
    expect(staff.user.phone).toBe("+8801712345678");
    const account = await db.account.findFirstOrThrow({ where: { userId: staff.userId, providerId: "credential" } });
    expect(await verifyPassword({ hash: account.password!, password: temporaryPassword })).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "staff.created", entityId: staffId } });
    expect(audit.actorId).toBe(owner.userId);
    expect(JSON.stringify(audit.after)).not.toContain(temporaryPassword);
  });

  it("denies staff management without permission", async () => {
    const catalogManager = await createStaffActor(businessId, "catalog_manager");
    await expect(
      createStaff(catalogManager, { name: "X Y", email: "x@example.test", roleId: await roleId("order_agent") }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stops non-owners from creating or managing owners", async () => {
    const admin = await createStaffActor(businessId, "store_admin");
    await expect(
      createStaff(admin, { name: "New Owner", email: "o2@example.test", roleId: await roleId("owner") }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setStaffStatus(admin, owner.staffId, "SUSPENDED")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects duplicate emails and invalid phone numbers", async () => {
    const input = { name: "Dup", email: "dup@example.test", roleId: await roleId("crm_agent") };
    await createStaff(owner, input);
    await expect(createStaff(owner, input)).rejects.toBeInstanceOf(ConflictError);
    await expect(createStaff(owner, { ...input, email: "p@example.test", phone: "12345" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("suspension disables the user, revokes sessions and removes access", async () => {
    const agent = await createStaffActor(businessId, "order_agent");
    await db.session.create({
      data: { id: randomUUID(), token: randomUUID(), userId: agent.userId, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await setStaffStatus(owner, agent.staffId, "SUSPENDED", "left the company");
    expect(await db.session.count({ where: { userId: agent.userId } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.userId } })).status).toBe("DISABLED");
    expect(await loadStaffActor(db, agent.userId)).toBeNull();
    await setStaffStatus(owner, agent.staffId, "ACTIVE");
    expect(await loadStaffActor(db, agent.userId)).not.toBeNull();
  });

  it("keeps at least one active owner and forbids self-changes", async () => {
    await expect(setStaffStatus(owner, owner.staffId, "SUSPENDED")).rejects.toBeInstanceOf(ConflictError);
    await expect(changeStaffRole(owner, owner.staffId, await roleId("crm_agent"))).rejects.toBeInstanceOf(ConflictError);
    const secondOwner = await createStaffActor(businessId, "owner");
    await changeStaffRole(owner, secondOwner.staffId, await roleId("crm_agent"));
    expect((await loadStaffActor(db, secondOwner.userId))?.roleKey).toBe("crm_agent");
  });

  it("role changes take effect on the next actor resolution", async () => {
    const agent = await createStaffActor(businessId, "crm_agent");
    expect(agent.permissions.has("catalog.update")).toBe(false);
    await changeStaffRole(owner, agent.staffId, await roleId("catalog_manager"));
    expect((await loadStaffActor(db, agent.userId))?.permissions.has("catalog.update")).toBe(true);
  });

  it("password reset issues a new temporary password and forces a change", async () => {
    const agent = await createStaffActor(businessId, "crm_agent");
    await db.account.create({ data: { id: randomUUID(), accountId: agent.userId, providerId: "credential", userId: agent.userId, password: "old" } });
    const { temporaryPassword } = await resetStaffPassword(owner, agent.staffId);
    const account = await db.account.findFirstOrThrow({ where: { userId: agent.userId } });
    expect(await verifyPassword({ hash: account.password!, password: temporaryPassword })).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.userId } })).mustChangePassword).toBe(true);
  });
});

describe("roles", () => {
  it("drops unknown permission keys", async () => {
    const role = await createRole(owner, { name: "Packers", permissions: ["orders.view", "made.up"] });
    expect(role.permissions).toEqual(["orders.view"]);
  });

  it("prevents privilege escalation by non-owners", async () => {
    const limited = await createRole(owner, { name: "Role admin", permissions: ["roles.manage", "staff.view"] });
    const roleAdmin = await createStaffActor(businessId, limited.key);
    await expect(createRole(roleAdmin, { name: "Sneaky", permissions: ["catalog.delete"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createRole(roleAdmin, { name: "Fine", permissions: ["staff.view"] })).resolves.toBeTruthy();
  });

  it("protects the owner role", async () => {
    await expect(updateRole(owner, await roleId("owner"), { name: "Owner", permissions: [] })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within the window, per subject", async () => {
    const rule = { name: `test:${randomUUID()}`, limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) await consumeRateLimit(db, rule, "1.2.3.4");
    await expect(consumeRateLimit(db, rule, "1.2.3.4")).rejects.toBeInstanceOf(RateLimitedError);
    await expect(consumeRateLimit(db, rule, "5.6.7.8")).resolves.toBeUndefined();
  });

  it("resets after the window expires", async () => {
    const rule = { name: `test:${randomUUID()}`, limit: 1, windowSeconds: 60 };
    await consumeRateLimit(db, rule, "subject");
    await db.rateLimitBucket.update({ where: { key: `${rule.name}:subject` }, data: { windowStart: new Date(Date.now() - 61_000) } });
    await expect(consumeRateLimit(db, rule, "subject")).resolves.toBeUndefined();
  });
});
