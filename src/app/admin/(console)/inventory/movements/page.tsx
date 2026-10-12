import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listMovements } from "@/modules/inventory/inventory.service";

export const metadata: Metadata = { title: "Stock ledger" };

const TYPE_LABEL: Record<string, string> = {
  OPENING_BALANCE: "Opening balance", RECEIPT: "Received", ADJUSTMENT_IN: "Adjusted in", ADJUSTMENT_OUT: "Adjusted out",
  DAMAGE: "Damaged", RESERVE: "Reserved", RELEASE: "Released", SALE: "Sold", RETURN_RESTOCK: "Returned to stock",
};

async function Movements({ searchParams }: Pick<PageProps<"/admin/inventory/movements">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "inventory.view")) return <AccessDenied permission="inventory.view" />;
  const sp = await searchParams;
  const result = await listMovements(actor, { page: Number(sp.page ?? 1) || 1 });
  return (
    <>
      <AdminPageHeader title="Stock ledger" description="Every stock change, with who made it and why. Entries cannot be edited or deleted." />
      <Card>
        {result.rows.length === 0 ? (
          <EmptyState title="No stock movements yet" className="border-0" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Product</Th>
                <Th>Type</Th>
                <Th className="text-right">On hand</Th>
                <Th className="text-right">Reserved</Th>
                <Th>By / reason</Th>
              </tr>
            </THead>
            <TBody>
              {result.rows.map((m) => (
                <Tr key={m.id}>
                  <Td className="text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</Td>
                  <Td>
                    <p className="text-sm">{m.variant.product.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{m.variant.sku}</p>
                  </Td>
                  <Td><Badge>{TYPE_LABEL[m.type] ?? m.type}</Badge></Td>
                  <Td className="text-right tabular-nums">{m.onHandDelta !== 0 ? `${m.onHandDelta > 0 ? "+" : ""}${m.onHandDelta} → ${m.onHandAfter}` : m.onHandAfter}</Td>
                  <Td className="text-right tabular-nums">{m.reservedDelta !== 0 ? `${m.reservedDelta > 0 ? "+" : ""}${m.reservedDelta} → ${m.reservedAfter}` : m.reservedAfter}</Td>
                  <Td className="text-xs">
                    <p>{m.actorName ?? (m.actorType === "CUSTOMER" ? "Customer" : m.actorType === "SYSTEM" ? "System" : "Staff")}</p>
                    {m.note || m.reason ? <p className="text-muted-foreground">{m.note || m.reason}</p> : null}
                    {m.sourceType ? <p className="text-subtle-foreground">{m.sourceType}</p> : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {result.page} of {result.pageCount}</p>
          <div className="flex gap-2">
            {result.page > 1 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?page=${result.page - 1}`}>Previous</Link> : null}
            {result.page < result.pageCount ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`?page=${result.page + 1}`}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

export default function MovementsPage({ searchParams }: PageProps<"/admin/inventory/movements">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Movements searchParams={searchParams} />
    </Suspense>
  );
}
