import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { can, isOwner } from "@/modules/identity/actor";
import { OWNER_ROLE_KEY } from "@/modules/identity/permissions";
import { listRoles } from "@/modules/identity/roles.service";
import { requireStaff } from "@/modules/identity/session";
import { listStaff } from "@/modules/identity/staff.service";
import { AddStaffForm, ResetPasswordForm, StaffRoleForm, StaffStatusForm, type RoleOption } from "./staff-forms";

export const metadata: Metadata = { title: "Staff" };

async function StaffContent() {
  const actor = await requireStaff();
  if (!can(actor, "staff.view")) return <AccessDenied permission="staff.view" />;
  const [staff, roles] = await Promise.all([listStaff(actor), listRoles(actor)]);
  const manage = can(actor, "staff.manage");
  const roleOptions: RoleOption[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    assignable: r.key !== OWNER_ROLE_KEY || isOwner(actor),
  }));

  return (
    <>
      <AdminPageHeader
        title="Staff"
        description={`${staff.length} staff account${staff.length === 1 ? "" : "s"}. Access is controlled by roles.`}
        actions={
          <Link href="/admin/staff/roles" className={buttonVariants({ variant: "outline" })}>
            <ShieldCheck /> Roles & permissions
          </Link>
        }
      />

      <Card>
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Added</Th>
              {manage ? <Th className="text-right">Actions</Th> : null}
            </tr>
          </THead>
          <TBody>
            {staff.map((member) => {
              const self = member.id === actor.staffId;
              const protectedOwner = member.role.key === OWNER_ROLE_KEY && !isOwner(actor);
              const editable = manage && !self && !protectedOwner;
              return (
                <Tr key={member.id}>
                  <Td>
                    <p className="font-medium">
                      {member.user.name} {self ? <Badge className="ml-1">You</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    {member.jobTitle ? <p className="text-xs text-subtle-foreground">{member.jobTitle}</p> : null}
                  </Td>
                  <Td>
                    {editable ? (
                      <StaffRoleForm staffId={member.id} staffName={member.user.name} roleId={member.role.id} roles={roleOptions} />
                    ) : (
                      member.role.name
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {member.status === "ACTIVE" ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
                      {member.user.mustChangePassword ? <Badge tone="warning">Temporary password</Badge> : null}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDate(member.createdAt)}</Td>
                  {manage ? (
                    <Td>
                      {editable ? (
                        <div className="flex flex-col items-end gap-1">
                          <StaffStatusForm staffId={member.id} status={member.status} />
                          {member.status === "ACTIVE" ? <ResetPasswordForm staffId={member.id} /> : null}
                        </div>
                      ) : (
                        <p className="text-right text-xs text-subtle-foreground">{self ? "Your account" : "Owner only"}</p>
                      )}
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {manage ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Add staff member</CardTitle>
            <CardDescription>
              Creates an account with a one-time temporary password. The staff member signs in at /admin/login and must
              choose their own password.
            </CardDescription>
          </CardHeader>
          <div className="px-5 pb-5">
            <AddStaffForm roles={roleOptions} />
          </div>
        </Card>
      ) : null}
    </>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <StaffContent />
    </Suspense>
  );
}
