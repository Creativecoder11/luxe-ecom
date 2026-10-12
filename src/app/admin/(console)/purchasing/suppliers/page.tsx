import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, EmptyState } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listSuppliers } from "@/modules/purchasing/purchasing.service";
import { SupplierForm, type SupplierValue } from "./supplier-form";

export const metadata: Metadata = { title: "Suppliers" };

async function Suppliers({ searchParams }: Pick<PageProps<"/admin/purchasing/suppliers">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "purchasing.view")) return <AccessDenied permission="purchasing.view" />;
  const sp = await searchParams;
  const suppliers = await listSuppliers(actor, { includeInactive: true });
  const editing = typeof sp.edit === "string" ? suppliers.find((s) => s.id === sp.edit) : undefined;
  const canEdit = can(actor, "purchasing.manage");
  const value: SupplierValue | null =
    editing && canEdit
      ? { id: editing.id, name: editing.name, contactName: editing.contactName ?? "", phone: editing.phone ?? "", email: editing.email ?? "", address: editing.address ?? "", notes: editing.notes ?? "", isActive: editing.isActive }
      : sp.new !== undefined && canEdit
        ? { name: "", contactName: "", phone: "", email: "", address: "", notes: "", isActive: true }
        : null;
  return (
    <>
      <AdminPageHeader title="Suppliers" description="Who you buy stock from." actions={canEdit ? <Link href="?new" className={buttonVariants()}><Plus /> Add supplier</Link> : null} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          {suppliers.length === 0 ? (
            <EmptyState title="No suppliers yet" className="border-0" />
          ) : (
            <Table>
              <THead><tr><Th>Supplier</Th><Th>Contact</Th><Th className="text-right">POs</Th></tr></THead>
              <TBody>
                {suppliers.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <Link href={`?edit=${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                      {!s.isActive ? <Badge className="ml-2">Inactive</Badge> : null}
                    </Td>
                    <Td className="text-sm text-muted-foreground">{[s.contactName, s.phone].filter(Boolean).join(" · ") || "—"}</Td>
                    <Td className="text-right tabular-nums">{s._count.purchaseOrders}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div>
          {value ? (
            <Card>
              <CardHeader><CardTitle>{value.id ? `Edit “${value.name}”` : "New supplier"}</CardTitle></CardHeader>
              <div className="px-5 pb-5"><SupplierForm value={value} /></div>
            </Card>
          ) : (
            <EmptyState title="Select a supplier" description="Choose a supplier to edit, or add a new one." />
          )}
        </div>
      </div>
    </>
  );
}

export default function SuppliersPage({ searchParams }: PageProps<"/admin/purchasing/suppliers">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Suppliers searchParams={searchParams} />
    </Suspense>
  );
}
