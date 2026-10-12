import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { can } from "@/modules/identity/actor";
import { ALL_PERMISSIONS, OWNER_ROLE_KEY } from "@/modules/identity/permissions";
import { listRoles } from "@/modules/identity/roles.service";
import { requireStaff } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Roles & permissions" };

async function RolesContent() {
  const actor = await requireStaff();
  if (!can(actor, "staff.view")) return <AccessDenied permission="staff.view" />;
  const roles = await listRoles(actor);
  return (
    <>
      <AdminPageHeader
        title="Roles & permissions"
        description="Access is denied unless a role grants it. Changes apply on the next request."
        actions={
          can(actor, "roles.manage") ? (
            <Link href="/admin/staff/roles/new" className={buttonVariants()}>
              <Plus /> New role
            </Link>
          ) : null
        }
      />
      <Card>
        <Table>
          <THead>
            <tr>
              <Th>Role</Th>
              <Th>Permissions</Th>
              <Th>Staff</Th>
              <Th>Type</Th>
            </tr>
          </THead>
          <TBody>
            {roles.map((role) => (
              <Tr key={role.id}>
                <Td>
                  <Link href={`/admin/staff/roles/${role.id}`} className="font-medium hover:underline">
                    {role.name}
                  </Link>
                  {role.description ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
                </Td>
                <Td className="tabular-nums">
                  {role.key === OWNER_ROLE_KEY ? ALL_PERMISSIONS.length : role.permissions.length} / {ALL_PERMISSIONS.length}
                </Td>
                <Td className="tabular-nums">{role._count.staff}</Td>
                <Td>{role.isSystem ? <Badge>System</Badge> : <Badge tone="primary">Custom</Badge>}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <RolesContent />
    </Suspense>
  );
}
