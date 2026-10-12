import { ForbiddenError } from "@/lib/errors";
import { OWNER_ROLE_KEY, type Permission } from "./permissions";

/** An authenticated, active staff member with resolved permissions. Passed to every admin service. */
export interface StaffActor {
  kind: "staff";
  userId: string;
  staffId: string;
  businessId: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: ReadonlySet<Permission>;
}

/** System processes (seeds, jobs) act with explicit identity so audit records stay attributable. */
export interface SystemActor {
  kind: "system";
  businessId: string;
  label: string;
}

export type Actor = StaffActor | SystemActor;

export function isOwner(actor: Actor): boolean {
  return actor.kind === "staff" && actor.roleKey === OWNER_ROLE_KEY;
}

/** Deny by default: system actors are trusted callers; staff need the explicit permission. */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.kind === "system") return true;
  return actor.permissions.has(permission);
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw new ForbiddenError(permission);
}

export function actorAuditFields(actor: Actor): { actorType: "STAFF" | "SYSTEM"; actorId: string | null } {
  return actor.kind === "staff"
    ? { actorType: "STAFF", actorId: actor.userId }
    : { actorType: "SYSTEM", actorId: null };
}
