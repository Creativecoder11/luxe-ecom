import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listPurchaseOrders } from "@/modules/purchasing/purchasing.service";
import { PO_STATUS } from "./po-status";

export const metadata: Metadata = { title: "Purchasing" };


async function Purchasing() {
  const actor = await requireStaff();
  if (!can(actor, "purchasing.view")) return <AccessDenied permission="purchasing.view" />;
  const orders = await listPurchaseOrders(actor);
  return (
    <>
      <AdminPageHeader
        title="Purchasing"
        description="Purchase orders to suppliers. Receiving goods adds stock and updates average cost."
        actions={
          <>
            <Link href="/admin/purchasing/suppliers" className={buttonVariants({ variant: "outline" })}><Users /> Suppliers</Link>
            {can(actor, "purchasing.manage") ? <Link href="/admin/purchasing/new" className={buttonVariants()}><Plus /> New purchase order</Link> : null}
          </>
        }
      />
      <Card>
        {orders.length === 0 ? (
          <EmptyState title="No purchase orders yet" className="border-0" description="Add a supplier, then create a purchase order." />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Number</Th>
                <Th>Supplier</Th>
                <Th>Status</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Value</Th>
                <Th>Created</Th>
              </tr>
            </THead>
            <TBody>
              {orders.map((po) => {
                const ordered = po.items.reduce((n, i) => n + i.quantityOrdered, 0);
                const received = po.items.reduce((n, i) => n + i.quantityReceived, 0);
                const value = po.items.reduce((n, i) => n + i.quantityOrdered * i.unitCostMinor, 0);
                const status = PO_STATUS[po.status]!;
                return (
                  <Tr key={po.id}>
                    <Td><Link href={`/admin/purchasing/${po.id}`} className="font-mono font-medium hover:underline">{po.number}</Link></Td>
                    <Td>{po.supplier.name}</Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td className="text-right tabular-nums">{received} / {ordered}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(value)}</Td>
                    <Td className="text-muted-foreground">{formatDate(po.createdAt)}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}

export default function PurchasingPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Purchasing />
    </Suspense>
  );
}
