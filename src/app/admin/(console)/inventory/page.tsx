import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/display";
import { Input } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { ADJUSTMENT_REASONS, listStock, type StockFilter } from "@/modules/inventory/inventory.service";
import { AdjustStockForm } from "./adjust-form";

export const metadata: Metadata = { title: "Inventory" };

const STATUS = {
  ok: <Badge tone="success">In stock</Badge>,
  low: <Badge tone="warning">Low</Badge>,
  out: <Badge tone="danger">Out</Badge>,
  untracked: <Badge>Not tracked</Badge>,
};

async function Inventory({ searchParams }: Pick<PageProps<"/admin/inventory">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "inventory.view")) return <AccessDenied permission="inventory.view" />;
  const sp = await searchParams;
  const filter = (["low", "out"].includes(String(sp.filter)) ? sp.filter : "all") as StockFilter;
  const q = typeof sp.q === "string" ? sp.q : "";
  const result = await listStock(actor, { q, filter, page: Number(sp.page ?? 1) || 1 });
  const adjustId = typeof sp.adjust === "string" ? sp.adjust : null;
  const adjusting = adjustId ? result.rows.find((r) => r.variantId === adjustId) : undefined;
  const tabs: [StockFilter, string, number | null][] = [["all", "All", null], ["low", "Low or out", result.counts.low + result.counts.out], ["out", "Out of stock", result.counts.out]];
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { filter: filter === "all" ? undefined : filter, q: q || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/inventory${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Stock in the main warehouse. Available = on hand − reserved for unfulfilled orders."
        actions={<Link href="/admin/inventory/movements" className={buttonVariants({ variant: "outline" })}><History /> Stock ledger</Link>}
      />
      <nav aria-label="Stock filter" className="mb-4 flex gap-1 border-b border-border">
        {tabs.map(([value, label, count]) => (
          <Link key={value} href={href({ filter: value === "all" ? undefined : value, page: undefined })} aria-current={filter === value ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", filter === value ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label} {count !== null ? <span className="text-xs text-subtle-foreground">{count}</span> : null}
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex gap-2" role="search" aria-label="Search stock">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <label htmlFor="stock-q" className="sr-only">Search by product or SKU</label>
        <Input id="stock-q" name="q" defaultValue={q} placeholder="Search product or SKU" className="sm:w-72" />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>Search</button>
      </form>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          {result.rows.length === 0 ? (
            <EmptyState title="Nothing to show" className="border-0" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th className="text-right">On hand</Th>
                  <Th className="text-right">Reserved</Th>
                  <Th className="text-right">Available</Th>
                  <Th>Status</Th>
                  {can(actor, "inventory.adjust") ? <Th><span className="sr-only">Actions</span></Th> : null}
                </tr>
              </THead>
              <TBody>
                {result.rows.map((r) => (
                  <Tr key={r.variantId} className={adjustId === r.variantId ? "bg-accent-soft" : undefined}>
                    <Td>
                      <p className="font-medium">{r.productTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.variantTitle ? `${r.variantTitle} · ` : ""}<span className="font-mono">{r.sku}</span></p>
                    </Td>
                    <Td className="text-right tabular-nums">{r.trackInventory ? r.onHand : "—"}</Td>
                    <Td className="text-right tabular-nums">{r.trackInventory ? r.reserved : "—"}</Td>
                    <Td className="text-right font-semibold tabular-nums">{r.trackInventory ? r.available : "—"}</Td>
                    <Td>{STATUS[r.status]}</Td>
                    {can(actor, "inventory.adjust") ? (
                      <Td>{r.trackInventory ? <Link href={href({ adjust: r.variantId })} className="text-sm font-medium hover:underline">Adjust</Link> : null}</Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div>
          {adjusting && can(actor, "inventory.adjust") ? (
            <Card>
              <CardHeader>
                <CardTitle>Adjust stock</CardTitle>
                <CardDescription>{adjusting.productTitle}{adjusting.variantTitle ? ` · ${adjusting.variantTitle}` : ""} · {adjusting.onHand} on hand, {adjusting.reserved} reserved</CardDescription>
              </CardHeader>
              <div className="px-5 pb-5">
                <AdjustStockForm key={adjusting.variantId} variantId={adjusting.variantId} reasons={Object.entries(ADJUSTMENT_REASONS)} />
              </div>
            </Card>
          ) : (
            <EmptyState title="Adjust stock" description="Choose “Adjust” on a row to record a count, damage or opening balance. Goods from suppliers are received through Purchasing." />
          )}
        </div>
      </div>
    </>
  );
}

export default function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Inventory searchParams={searchParams} />
    </Suspense>
  );
}
