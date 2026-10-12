import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FileText, Plus, Search, SquarePen, Trash2, TrendingDown, TrendingUp, Truck, X, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { ADMIN_ORDERS_PAGE_SIZE, ADMIN_ORDERS_PAGE_SIZES, listAdminOrders, type AdminOrderFilters, type AdminOrderSort, type CustomerSuccessRate } from "@/modules/orders/admin-orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL } from "@/modules/orders/labels";
import { OrderFilterForm, OrderSelection, PrintButton } from "./orders-client";

export const metadata: Metadata = { title: "Orders" };

/** Short payment labels for the dense list; the order page shows the full PAYMENT_STATUS_LABEL. */
const PAYMENT_SHORT: Record<string, { label: string; className: string }> = {
  COD_UNPAID: { label: "Unpaid", className: "text-danger" },
  COD_COLLECTION_PENDING: { label: "Collecting", className: "text-warning" },
  COD_COLLECTED: { label: "Paid", className: "text-success" },
  REMITTED: { label: "Paid", className: "text-success" },
  FAILED_COLLECTION: { label: "Not collected", className: "text-danger" },
  VOID: { label: "Void", className: "text-muted-foreground" },
};

/** Compact status names for the list badges; the full ORDER_STATUS_LABEL is kept as the tooltip. */
const STATUS_SHORT: Record<string, string> = { PENDING_CONFIRMATION: "Pending", OUT_FOR_DELIVERY: "Out for delivery", DELIVERY_FAILED: "Failed", RETURN_REQUESTED: "Return req.", RETURN_APPROVED: "Return ok", PARTIALLY_RETURNED: "Part. returned" };

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" });
const GATE_4 = "Arrives with order management (Gate 4)";

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** 1 … 4 5 6 … 12 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1]! > 1 ? (["gap", p] as const) : [p]));
}

function SuccessRate({ data }: { data: CustomerSuccessRate }) {
  if (data.rate === null) return <span className="text-xs whitespace-nowrap text-subtle-foreground">New customer</span>;
  const tier = data.rate >= 80 ? { label: "High", text: "text-success", bg: "bg-success", soft: "bg-success-soft" } : data.rate >= 50 ? { label: "Mid", text: "text-warning", bg: "bg-warning", soft: "bg-warning-soft" } : { label: "Risk", text: "text-danger", bg: "bg-danger", soft: "bg-danger-soft" };
  const up = (data.recentRate ?? data.rate) >= data.rate;
  return (
    <div className="w-32" title={`${data.delivered} of ${data.finished} finished orders delivered`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5">
          <span className={cn("text-sm font-bold tabular-nums", tier.text)}>{data.rate}%</span>
          <span className={cn("rounded px-1 text-[10px] font-semibold", tier.text, tier.soft)}>{tier.label}</span>
        </p>
        <span className={cn("inline-flex items-center rounded px-1 py-0.5", up ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {up ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
          <span className="sr-only">Recent orders trending {up ? "up" : "down"}</span>
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface-sunken">
        <div className={cn("h-1 rounded-full", tier.bg)} style={{ width: `${data.rate}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          Last {String(data.recent.length).padStart(2, "0")}
          <span className="flex gap-0.5" aria-label={`${data.recent.filter(Boolean).length} of last ${data.recent.length} delivered`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={cn("size-2 rounded-sm", data.recent[i] === undefined ? "bg-surface-sunken" : data.recent[i] ? "bg-success" : "bg-danger")} />
            ))}
          </span>
        </span>
        <span className="text-[10px] font-medium whitespace-nowrap text-foreground">{data.delivered}/{data.finished} all</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, tone, href, active }: { label: string; value: number; hint: string; tone: string; href: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("rounded-xl border bg-surface p-4 shadow-card transition-colors hover:border-border-strong", active ? "border-primary" : "border-border")}>
      <p className={cn("text-sm font-medium", tone)}>{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold tabular-nums", tone === "text-foreground" ? "" : tone)}>{String(value).padStart(2, "0")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "orders.view")) return <AccessDenied permission="orders.view" />;
  const sp = await searchParams;
  const filters: AdminOrderFilters = {
    q: first(sp.q),
    status: first(sp.status),
    paymentStatus: first(sp.payment),
    date: first(sp.date),
    minTotal: first(sp.min),
    maxTotal: first(sp.max),
    sort: first(sp.sort),
    dir: first(sp.dir),
    page: Number(first(sp.page) ?? 1) || 1,
    pageSize: Number(first(sp.size)) || ADMIN_ORDERS_PAGE_SIZE,
  };
  const result = await listAdminOrders(actor, filters);
  const params = { q: filters.q, status: filters.status, payment: filters.paymentStatus, date: filters.date, min: filters.minTotal, max: filters.maxTotal, sort: filters.sort, dir: filters.dir, size: result.pageSize === ADMIN_ORDERS_PAGE_SIZE ? undefined : String(result.pageSize) };
  const query = (overrides: Record<string, string | undefined>, base = "/admin/orders") => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...overrides })) if (v) p.set(k, v);
    const s = p.toString();
    return `${base}${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(filters.q || filters.status || filters.paymentStatus || filters.date || filters.minTotal || filters.maxTotal);
  const activeSort = (filters.sort as AdminOrderSort | undefined) ?? "date";
  const activeDir = filters.dir === "asc" ? "asc" : "desc";
  const sortHeader = (key: AdminOrderSort, label: string, className?: string) => {
    const active = activeSort === key;
    const Icon = !active ? ArrowUpDown : activeDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <Th className={className} aria-sort={active ? (activeDir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={query({ sort: key, dir: active && activeDir === "desc" ? "asc" : "desc", page: undefined })} className="inline-flex items-center gap-1 hover:text-foreground">
          {label} <Icon className={cn("size-3.5", active ? "text-foreground" : "")} aria-hidden="true" />
        </Link>
      </Th>
    );
  };
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  const iconButton = "inline-flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5";
  const disabledButton = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8");

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl bg-accent-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h1 className="text-xl font-bold">Orders</h1>
        <div className="flex flex-wrap gap-2">
          {can(actor, "orders.export") ? (
            <a href={query({ page: undefined, size: undefined }, "/admin/orders/export")} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden="true" /> Export CSV
            </a>
          ) : null}
          <PrintButton />
          {can(actor, "orders.create") ? (
            <button type="button" disabled title={GATE_4} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden="true" /> New Order
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 print:hidden">
        <StatCard label="All Orders" value={result.summary.all} hint="total entries" tone="text-foreground" href="/admin/orders" active={!filters.status} />
        <StatCard label="Pending" value={result.summary.pending} hint="awaiting confirmation" tone="text-warning" href="/admin/orders?status=PENDING_CONFIRMATION" active={filters.status === "PENDING_CONFIRMATION"} />
        <StatCard label="Processing" value={result.summary.inProgress} hint="in progress" tone="text-info" href="/admin/orders?status=IN_PROGRESS" active={filters.status === "IN_PROGRESS"} />
        <StatCard label="Complete" value={result.summary.delivered} hint="delivered" tone="text-success" href="/admin/orders?status=DELIVERED" active={filters.status === "DELIVERED"} />
        <StatCard label="Cancelled" value={result.summary.cancelled} hint="lost revenue" tone="text-danger" href="/admin/orders?status=CANCELLED" active={filters.status === "CANCELLED"} />
      </div>

      <Card className="mb-4 p-3 print:hidden">
        <OrderFilterForm role="search" aria-label="Filter orders" className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-sm">
          {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
          {filters.dir ? <input type="hidden" name="dir" value={filters.dir} /> : null}
          {params.size ? <input type="hidden" name="size" value={params.size} /> : null}
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden="true" />
            <label htmlFor="order-q" className="sr-only">Search orders</label>
            <Input id="order-q" name="q" defaultValue={filters.q ?? ""} placeholder="Search by order, customer, phone" className="h-9 bg-surface-muted pl-9" />
          </div>
          <label className="flex items-center gap-2 text-muted-foreground">
            Date
            <Input type="date" name="date" defaultValue={filters.date ?? ""} className="h-9 w-36" />
          </label>
          <label className="sr-only" htmlFor="order-payment">Payment status</label>
          <Select id="order-payment" name="payment" defaultValue={filters.paymentStatus ?? ""} className="h-9 w-40">
            <option value="">Payment status</option>
            {Object.keys(PAYMENT_STATUS_LABEL).map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-muted-foreground">
            Status
            <Select name="status" defaultValue={filters.status ?? ""} className="h-9 w-40">
              <option value="">All statuses</option>
              <option value="IN_PROGRESS">In progress (all)</option>
              {Object.keys(ORDER_STATUS_LABEL).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-muted-foreground" title="Courier integration arrives in Gate 5">
            Courier
            <Select disabled defaultValue="" className="h-9 w-32">
              <option value="">All couriers</option>
            </Select>
          </label>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <label htmlFor="order-min">min ৳</label>
            <Input id="order-min" name="min" type="number" min={0} step="any" inputMode="decimal" defaultValue={filters.minTotal ?? ""} placeholder="0" className="h-9 w-20" />
            <span aria-hidden="true">–</span>
            <label htmlFor="order-max" className="sr-only">Max total</label>
            <Input id="order-max" name="max" type="number" min={0} step="any" inputMode="decimal" defaultValue={filters.maxTotal ?? ""} placeholder="∞" className="h-9 w-20" />
          </div>
          <button type="submit" className="sr-only focus:not-sr-only">Apply filters</button>
          {filtered ? (
            <Link href="/admin/orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <X aria-hidden="true" /> Clear
            </Link>
          ) : null}
        </OrderFilterForm>
      </Card>

      <Card>
        <OrderSelection
          actions={
            <>
              <button type="button" disabled title={GATE_4} className={disabledButton}>Bulk Action <ChevronDown aria-hidden="true" /></button>
              <button type="button" disabled title={GATE_4} className={disabledButton}><Zap aria-hidden="true" /> Change Status</button>
              <button type="button" disabled title="Courier integration arrives in Gate 5" className={disabledButton}><Truck aria-hidden="true" /> Assign Courier</button>
              <button type="button" disabled title={GATE_4} className={disabledButton}><Trash2 aria-hidden="true" /> Delete</button>
            </>
          }
          aside={
            <>
              <span className="text-sm text-muted-foreground tabular-nums">Showing {from}–{to} of {result.total}</span>
              <OrderFilterForm aria-label="Rows per page" className="flex items-center gap-2">
                {Object.entries({ ...params, size: undefined }).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
                <label htmlFor="order-size" className="sr-only">Rows per page</label>
                <Select id="order-size" name="size" defaultValue={String(result.pageSize)} className="h-8 w-20">
                  {ADMIN_ORDERS_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
                <noscript><button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>Go</button></noscript>
              </OrderFilterForm>
            </>
          }
        >
          {result.rows.length === 0 ? (
            <EmptyState title={filtered ? "No orders match" : "No orders yet"} description={filtered ? "Try different filters." : undefined} className="m-4" />
          ) : (
            <Table className="[&_td]:px-2 [&_th]:px-2 [&_th]:text-[13px] [&_th]:font-medium [&_th]:tracking-normal [&_th]:normal-case">
              <THead className="bg-transparent">
                <tr className="border-b border-border">
                  <Th className="w-10 print:hidden"><Checkbox data-select-all aria-label="Select all orders on this page" /></Th>
                  {sortHeader("number", "Order ID")}
                  {sortHeader("customer", "Customer")}
                  {sortHeader("status", "Status")}
                  <Th>Courier</Th>
                  {sortHeader("total", "Total")}
                  {sortHeader("date", "Date")}
                  <Th>Note</Th>
                  <Th>Success Rate</Th>
                  <Th className="text-center print:hidden">Actions</Th>
                </tr>
              </THead>
              <TBody>
                {result.rows.map((o) => {
                  const payment = PAYMENT_SHORT[o.paymentStatus] ?? { label: o.paymentStatus, className: "text-muted-foreground" };
                  return (
                    <Tr key={o.id}>
                      <Td className="print:hidden"><Checkbox name="orderIds" value={o.id} aria-label={`Select order ${o.number}`} /></Td>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="text-[13px] font-medium whitespace-nowrap tabular-nums hover:underline">{o.number}</Link>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-xs font-semibold text-muted-foreground" aria-hidden="true">{initials(o.contactName)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{o.contactName}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{o.contactPhoneDisplay}</p>
                          </div>
                        </div>
                      </Td>
                      <Td><Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"} title={ORDER_STATUS_LABEL[o.status]}>{STATUS_SHORT[o.status] ?? ORDER_STATUS_LABEL[o.status]}</Badge></Td>
                      <Td><span className="rounded-md bg-surface-muted px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground">Unassigned</span></Td>
                      <Td className="whitespace-nowrap">
                        <p className="font-semibold tabular-nums">{formatMoney(o.totalMinor, o.currency, { showDecimals: o.totalMinor % 100 !== 0 })}</p>
                        <p className={cn("text-xs font-medium", payment.className)} title={PAYMENT_STATUS_LABEL[o.paymentStatus]}>{payment.label}</p>
                      </Td>
                      <Td className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{dayFormat.format(o.placedAt)}</Td>
                      <Td className="max-w-24">
                        {o.customerNote ? <p className="truncate text-xs" title={o.customerNote}>{o.customerNote}</p> : <span className="text-xs text-subtle-foreground">N/A</span>}
                      </Td>
                      <Td><SuccessRate data={o.successRate} /></Td>
                      <Td className="print:hidden">
                        <div className="flex items-center justify-center gap-0.5">
                          <button type="button" disabled title={GATE_4} aria-label="Edit order" className={cn(iconButton, "bg-surface-muted text-foreground disabled:opacity-40")}><SquarePen aria-hidden="true" /></button>
                          <Link href={`/admin/orders/${o.id}`} title="View order" aria-label="View order details" className={cn(iconButton, "bg-info-soft text-info hover:opacity-80")}><Eye aria-hidden="true" /></Link>
                          <button type="button" disabled title={GATE_4} aria-label="Download invoice" className={cn(iconButton, "bg-surface-muted text-foreground disabled:opacity-40")}><Download aria-hidden="true" /></button>
                          <button type="button" disabled title={GATE_4} aria-label="Packing slip" className={cn(iconButton, "bg-surface-muted text-foreground disabled:opacity-40")}><FileText aria-hidden="true" /></button>
                          <button type="button" disabled title={GATE_4} aria-label="Delete order" className={cn(iconButton, "bg-danger-soft text-danger disabled:opacity-40")}><Trash2 aria-hidden="true" /></button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </OrderSelection>

        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm print:hidden">
          <p className="text-muted-foreground">Page {result.page} of {result.pageCount}</p>
          <div className="flex items-center gap-1">
            {result.page > 1 ? (
              <Link href={query({ page: String(result.page - 1) })} aria-label="Previous page" className={buttonVariants({ variant: "secondary", size: "icon-sm" })}><ChevronLeft aria-hidden="true" /></Link>
            ) : (
              <span aria-hidden="true" className={cn(buttonVariants({ variant: "secondary", size: "icon-sm" }), "opacity-50")}><ChevronLeft /></span>
            )}
            {pageWindow(result.page, result.pageCount).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Link key={p} href={query({ page: p === 1 ? undefined : String(p) })} aria-current={p === result.page ? "page" : undefined} className={buttonVariants({ variant: p === result.page ? "primary" : "secondary", size: "icon-sm" })}>{p}</Link>
              ),
            )}
            {result.page < result.pageCount ? (
              <Link href={query({ page: String(result.page + 1) })} aria-label="Next page" className={buttonVariants({ variant: "secondary", size: "icon-sm" })}><ChevronRight aria-hidden="true" /></Link>
            ) : (
              <span aria-hidden="true" className={cn(buttonVariants({ variant: "secondary", size: "icon-sm" }), "opacity-50")}><ChevronRight /></span>
            )}
          </div>
          <p className="text-muted-foreground">{result.pageSize} rows per page</p>
        </nav>
      </Card>
    </>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}
