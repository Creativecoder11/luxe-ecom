import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { can, isOwner } from "@/modules/identity/actor";
import { ALL_PERMISSIONS } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";
import { createRoleAction } from "../../actions";
import { permissionGroupsView } from "../permission-groups";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "New role" };

async function NewRole() {
  const actor = await requireStaff();
  if (!can(actor, "roles.manage")) return <AccessDenied permission="roles.manage" />;
  const grantable = isOwner(actor) ? [...ALL_PERMISSIONS] : [...actor.permissions];
  return (
    <>
      <AdminPageHeader title="New role" description="Grant only what this role needs." />
      <RoleForm action={createRoleAction} groups={permissionGroupsView()} grantable={grantable} />
    </>
  );
}

export default function NewRolePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewRole />
    </Suspense>
  );
}
