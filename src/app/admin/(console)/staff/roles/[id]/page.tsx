import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { Alert } from "@/components/ui/display";
import { NotFoundError } from "@/lib/errors";
import { can, isOwner } from "@/modules/identity/actor";
import { ALL_PERMISSIONS, OWNER_ROLE_KEY } from "@/modules/identity/permissions";
import { getRole } from "@/modules/identity/roles.service";
import { requireStaff } from "@/modules/identity/session";
import { updateRoleAction } from "../../actions";
import { permissionGroupsView } from "../permission-groups";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Edit role" };

async function EditRole({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff();
  if (!can(actor, "staff.view")) return <AccessDenied permission="staff.view" />;
  const role = await getRole(actor, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const isOwnerRole = role.key === OWNER_ROLE_KEY;
  const readOnly = isOwnerRole || !can(actor, "roles.manage");
  const grantable = isOwner(actor) ? [...ALL_PERMISSIONS] : [...actor.permissions];

  return (
    <>
      <AdminPageHeader title={role.name} description={role.isSystem ? "System role" : "Custom role"} />
      {isOwnerRole ? (
        <Alert tone="info" className="mb-6">
          The owner role always has every permission and cannot be edited.
        </Alert>
      ) : null}
      <RoleForm
        action={updateRoleAction}
        groups={permissionGroupsView()}
        grantable={grantable}
        readOnly={readOnly}
        role={{
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: isOwnerRole ? [...ALL_PERMISSIONS] : role.permissions,
          isSystem: role.isSystem,
          staffCount: role._count.staff,
        }}
      />
    </>
  );
}

export default function EditRolePage({ params }: PageProps<"/admin/staff/roles/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditRole params={params} />
    </Suspense>
  );
}
