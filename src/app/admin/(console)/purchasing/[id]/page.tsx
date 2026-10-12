import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { Alert, Badge, Card, CardHeader, CardTitle } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { getPurchaseOrder } from "@/modules/purchasing/purchasing.service";
import { PO_STATUS } from "../po-status";
import { PurchaseOrderActions, ReceiveForm } from "../po-forms";

export const metadata: Metadata = { title: "Purchase order" };

async function PurchaseOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PageProps<"/admin/purchasing/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireStaff();
  if (!can(actor, "purchasing.view")) return <AccessDenied permission="purchasing.view" />;
  const po = await getPurchaseOrder(actor, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const status = PO_STATUS[po.status]!;
  const receivable = ["ORDERED", "PARTIALLY_RECEIVED"].includes(po.status) && can(actor, "purchasing.manage");
  const remainingItems = po.items.filter((i) => i.quantityReceived < i.quantityOrdered);
  const label = (i: (typeof po.items)[number]) => `${i.variant.product.title}${i.variant.title && i.variant.title !== "Default" ? ` · ${i.variant.title}` : ""}`;

  return (
    <>
      <AdminPageHeader
        title={po.number}
        description={<span className="flex items-center gap-2"><Badge tone={status.tone}>{status.label}</Badge> {po.supplier.name}</span>}
      />
      {sp.created ? <Alert tone="success" className="mb-4">Draft created. Place it with the supplier when approved.</Alert> : null}
      <div className="mb-6">
        <PurchaseOrderActions
          id={po.id}
          canPlace={po.status === "DRAFT" && can(actor, "purchasing.approve")}
          canCancel={["DRAFT", "ORDERED"].includes(po.status) && can(actor, "purchasing.manage")}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <Card>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Unit cost</Th>
                <Th className="text-right">Line</Th>
              </tr>
            </THead>
            <TBody>
              {po.items.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <p>{label(i)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{i.variant.sku}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{i.quantityOrdered}</Td>
                  <Td className="text-right tabular-nums">{i.quantityReceived}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(i.unitCostMinor)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(i.unitCostMinor * i.quantityOrdered)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <div className="space-y-1 border-t border-border p-5 text-sm text-muted-foreground">
            {po.expectedAt ? <p>Expected {formatDate(po.expectedAt)}</p> : null}
            {po.notes ? <p>Notes: {po.notes}</p> : null}
          </div>
        </Card>
        <div className="space-y-6">
          {receivable && remainingItems.length ? (
            <Card>
              <CardHeader><CardTitle>Receive goods</CardTitle></CardHeader>
              <div className="px-5 pb-5">
                <ReceiveForm id={po.id} items={remainingItems.map((i) => ({ id: i.id, label: label(i), remaining: i.quantityOrdered - i.quantityReceived }))} />
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Receipts</CardTitle></CardHeader>
            <ul className="space-y-2 px-5 pb-5 text-sm">
              {po.receipts.length === 0 ? <li className="text-muted-foreground">Nothing received yet.</li> : null}
              {po.receipts.map((r) => <li key={r.id}><span className="font-mono">{r.number}</span> · {formatDateTime(r.receivedAt)}</li>)}
            </ul>
          </Card>
          <Link href="/admin/purchasing" className="text-sm text-muted-foreground hover:underline">← All purchase orders</Link>
        </div>
      </div>
    </>
  );
}

export default function PurchaseOrderPage({ params, searchParams }: PageProps<"/admin/purchasing/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <PurchaseOrderDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
