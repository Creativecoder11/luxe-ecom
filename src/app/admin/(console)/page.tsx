import { ArrowDown, ArrowRight, ArrowUp, Award, Boxes, ChevronDown, LayoutGrid, Minus, PackageX, Truck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BarChart } from "@/components/admin/charts/bar-chart";
import { NEUTRAL_COLOR, SERIES_COLORS } from "@/components/admin/charts/palette";
import { DonutChart } from "@/components/admin/charts/donut-chart";
import { LineChart } from "@/components/admin/charts/line-chart";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { can, type StaffActor } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import {
  getCatalogCounts,
  getCustomerSummary,
  getMonthlyTrends,
  getOrdersByChannel,
  getOrderStatusSummary,
  getSalesSummary,
  getTopCategories,
  getTopProducts,
  getYearlyTotals,
  type Delta,
} from "@/modules/reports/dashboard";
import { MONTH_LABELS, parseRange, RANGE_KEYS, RANGE_LABEL, type RangeKey } from "@/modules/reports/definitions";

export const metadata: Metadata = { title: "Dashboard" };

type Params = Record<string, string | string[] | undefined>;
const money = (minor: number) => formatMoney(minor, "BDT");
const count = (n: number) => new Intl.NumberFormat("en-IN").format(n);

function RangeMenu({ param, value, params, tone = "light" }: { param: string; value: RangeKey; params: Params; tone?: "light" | "dark" }) {
  // Plain links in a <details> menu: works without JavaScript and keeps the other cards' ranges.
  const href = (range: RangeKey) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string") sp.set(k, v);
    sp.set(param, range);
    return `/admin?${sp.toString()}`;
  };
  return (
    <details className="relative">
      <summary
        className={cn(
          "flex h-8 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden",
          tone === "dark" ? "border-white/30 text-white hover:bg-white/10" : "border-border text-[#344054] hover:bg-surface-muted",
        )}
      >
        {RANGE_LABEL[value]} <ChevronDown className="size-3.5" aria-hidden="true" />
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-border bg-surface p-1 shadow-raised">
        {RANGE_KEYS.map((r) => (
          <li key={r}>
            <Link href={href(r)} scroll={false} aria-current={r === value ? "true" : undefined} className={cn("block rounded-md px-2.5 py-1.5 text-xs hover:bg-surface-muted", r === value && "font-semibold text-[#1570ef]")}>
              {RANGE_LABEL[r]}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DashCard({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card", className)} aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-sans text-sm font-medium tracking-normal text-[#344054]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DeltaPill({ delta, tone = "light" }: { delta: Delta; tone?: "light" | "dark" }) {
  if (delta.percent === null) {
    return <span className={cn("text-xs", tone === "dark" ? "text-white/75" : "text-muted-foreground")}>No earlier data to compare</span>;
  }
  const up = delta.percent > 0;
  const flat = delta.percent === 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          tone === "dark" ? "bg-white/90 text-[#101828]" : flat ? "bg-surface-muted text-muted-foreground" : up ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {Math.abs(delta.percent)}%
        <span className="sr-only">{flat ? "no change" : up ? "increase" : "decrease"}</span>
      </span>
      <span className={tone === "dark" ? "text-white/80" : "text-muted-foreground"}>{delta.label}</span>
    </span>
  );
}

function NotTracked({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Initials({ name, title }: { name: string; title?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span title={title ?? name} className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-surface bg-[#d1e3fd] text-[0.6875rem] font-bold text-[#0b4fb3] first:ml-0">
      {initials || "?"}
    </span>
  );
}

function StatBadge({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "red" }) {
  return (
    <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      {label}
      <span className={cn("min-w-7 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] font-bold text-white", tone === "blue" ? "bg-[#1570ef]" : tone === "green" ? "bg-[#12b76a]" : "bg-[#f04438]")}>
        {String(value).padStart(2, "0")}
      </span>
    </p>
  );
}

function CountCard({ icon, title, value, rows, href }: { icon: ReactNode; title: string; value: number; rows: ReactNode; href: string }) {
  return (
    <section className="flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card" aria-label={title}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#1570ef] text-white">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-sans text-sm font-medium tracking-normal">
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </h2>
        <p className="font-display text-2xl font-bold">{String(value).padStart(2, "0")}</p>
      </div>
      <div className="space-y-1.5">{rows}</div>
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<Params> }) {
  const actor: StaffActor = await requireStaff();
  if (!can(actor, "reports.view")) {
    return (
      <>
        <AdminPageHeader title={`Welcome, ${actor.name}`} description={`Signed in as ${actor.roleName}.`} />
        <p className="text-sm text-muted-foreground">Use the navigation to open the modules your role can access.</p>
      </>
    );
  }
  const params = await searchParams;
  const ranges = {
    kpi: parseRange(params.kpi, "month"),
    customers: parseRange(params.customers, "month"),
    channel: parseRange(params.channel, "month"),
    status: parseRange(params.status, "month"),
    cats: parseRange(params.cats, "month"),
    prods: parseRange(params.prods, "month"),
  };
  const [sales, customers, trends, years, channels, status, catalog, topCategories, topProducts] = await Promise.all([
    getSalesSummary(actor, ranges.kpi),
    getCustomerSummary(actor, ranges.customers),
    getMonthlyTrends(actor),
    getYearlyTotals(actor),
    getOrdersByChannel(actor, ranges.channel),
    getOrderStatusSummary(actor, ranges.status),
    getCatalogCounts(actor),
    getTopCategories(actor, ranges.cats),
    getTopProducts(actor, ranges.prods),
  ]);
  const monthLabels = trends.map((t) => MONTH_LABELS[t.month]!);
  const yearRevenue = trends.reduce((s, t) => s + t.websiteMinor + t.otherMinor, 0);
  const channelTotal = channels.reduce((s, c) => s + c.orders, 0);
  const canSeeFinance = can(actor, "finance.view");

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Figures are computed from your orders, customers, catalog and stock. Sales exclude drafts and cancelled orders; times are Bangladesh time.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_minmax(0,14rem)_minmax(0,1fr)]">
        <section aria-label="Sales" className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-[#101828] text-white shadow-card">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-xs text-white/70">Sales</span>
            <RangeMenu param="kpi" value={ranges.kpi} params={params} tone="dark" />
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#4ade80] to-[#22c55e] px-4 py-3 text-[#052e16]">
            <h2 className="font-sans text-xs font-medium tracking-normal">Gross sales</h2>
            <p className="font-display text-xl font-bold">{money(sales.revenue.value)}</p>
            <DeltaPill delta={sales.revenue.delta} tone="dark" />
          </div>
          <div className="-mt-3 rounded-2xl bg-gradient-to-br from-[#2e90fa] to-[#1570ef] px-4 pt-6 pb-3">
            <h2 className="font-sans text-xs font-medium tracking-normal">Total orders</h2>
            <p className="font-display text-xl font-bold">{count(sales.orders.value)}</p>
            <DeltaPill delta={sales.orders.delta} tone="dark" />
          </div>
          <div className="-mt-3 flex-1 rounded-b-2xl px-4 pt-6 pb-4">
            <h2 className="font-sans text-xs font-medium tracking-normal">Average order value</h2>
            <p className="font-display text-xl font-bold">{money(sales.aov.value)}</p>
            <DeltaPill delta={sales.aov.delta} tone="dark" />
          </div>
        </section>

        <DashCard title="Conversion & profit">
          <h3 className="text-xs text-muted-foreground">Conversion rate</h3>
          <NotTracked>Not tracked yet: needs storefront visit analytics.</NotTracked>
          <h3 className="mt-4 text-xs text-muted-foreground">Estimated gross profit ({RANGE_LABEL[ranges.kpi].toLowerCase()})</h3>
          <p className="font-display text-lg font-bold">{money(sales.grossProfit.value)}</p>
          <DeltaPill delta={sales.grossProfit.delta} />
          {sales.grossProfit.uncostedLines > 0 ? (
            <p className="mt-1 text-[0.6875rem] text-warning">
              {sales.grossProfit.uncostedLines} order line{sales.grossProfit.uncostedLines === 1 ? "" : "s"} without a cost price excluded.
            </p>
          ) : null}
          <h3 className="mt-4 text-xs text-muted-foreground">Net profit</h3>
          <NotTracked>Needs expense tracking (Finance).</NotTracked>
          {canSeeFinance ? (
            <Link href="/admin/finance" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline">
              View financial report <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </DashCard>

        <DashCard title="Customers" action={<RangeMenu param="customers" value={ranges.customers} params={params} />}>
          <Users className="mb-1 size-5 text-[#1570ef]" aria-hidden="true" />
          <h3 className="text-xs text-muted-foreground">Total customers</h3>
          <p className="font-display text-lg font-bold">{count(customers.total)}</p>
          <h3 className="mt-3 text-xs text-muted-foreground">Top customers</h3>
          {customers.top.length ? (
            <div className="mt-1 flex">
              {customers.top.map((c) => (
                <Initials key={c.id} name={c.name} title={`${c.name}: ${money(c.spentMinor)} across ${c.orders} order${c.orders === 1 ? "" : "s"}`} />
              ))}
            </div>
          ) : (
            <NotTracked>No orders in this period.</NotTracked>
          )}
          <h3 className="mt-3 text-xs text-muted-foreground">Cart abandonment</h3>
          <p className="font-display text-lg font-bold">{customers.cartAbandonmentPercent === null ? "—" : `${customers.cartAbandonmentPercent}%`}</p>
          <p className="text-[0.6875rem] text-muted-foreground">Carts idle 1h+ vs website orders</p>
          <h3 className="mt-3 text-xs text-muted-foreground">Repeat purchase (all time)</h3>
          <p className="font-display text-lg font-bold">{customers.repeatPurchasePercent === null ? "—" : `${customers.repeatPurchasePercent}%`}</p>
        </DashCard>

        <DashCard title="Average revenue per customer · this year" className="md:col-span-2 xl:col-span-1">
          <LineChart
            title="Average revenue per customer by month"
            labels={monthLabels}
            format="money"
            series={[{ key: "arpc", label: "Revenue per customer", color: SERIES_COLORS[0], values: trends.map((t) => t.revenuePerCustomerMinor) }]}
          />
        </DashCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard title="Orders by channel" action={<RangeMenu param="channel" value={ranges.channel} params={params} />}>
          <p className="-mt-2 mb-2 font-display text-2xl font-bold">
            {count(channelTotal)} <span className="text-sm font-medium text-muted-foreground">{RANGE_LABEL[ranges.channel]}</span>
          </p>
          <BarChart title="Orders by channel" labels={channels.map((c) => c.label)} format="count" series={[{ key: "orders", label: "Orders", color: SERIES_COLORS[0], values: channels.map((c) => c.orders) }]} />
        </DashCard>
        <DashCard title="New customers · this year">
          <p className="-mt-2 mb-2 font-display text-2xl font-bold">{count(trends.reduce((s, t) => s + t.newCustomers, 0))}</p>
          <LineChart title="New customers by month (first order)" labels={monthLabels} format="count" series={[{ key: "new", label: "New customers", color: SERIES_COLORS[0], values: trends.map((t) => t.newCustomers) }]} />
        </DashCard>
        <DashCard title="Revenue vs gross profit · by year">
          {years.length ? (
            <BarChart
              title="Revenue and estimated gross profit by year"
              labels={years.map((y) => y.year)}
              format="money"
              series={[
                { key: "profit", label: "Gross profit", color: SERIES_COLORS[1], values: years.map((y) => y.grossProfitMinor) },
                { key: "revenue", label: "Revenue", color: SERIES_COLORS[0], values: years.map((y) => y.revenueMinor) },
              ]}
            />
          ) : (
            <NotTracked>No sales recorded yet.</NotTracked>
          )}
        </DashCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard title="Order status" action={<RangeMenu param="status" value={ranges.status} params={params} />}>
          <DonutChart
            title="Orders by status"
            centerLabel="Total orders"
            segments={[
              { label: "In progress", value: status.open, color: SERIES_COLORS[0] },
              { label: "Delivered", value: status.delivered, color: SERIES_COLORS[1] },
              { label: "Cancelled / returned / failed", value: status.closed, color: NEUTRAL_COLOR },
            ]}
          />
          {status.awaiting > 0 ? (
            <Link href="/admin/orders?status=PENDING_CONFIRMATION" className="mt-3 block text-center text-xs font-semibold text-[#1570ef] hover:underline">
              {status.awaiting} awaiting confirmation →
            </Link>
          ) : null}
        </DashCard>
        <DashCard title="Sales overview · this year" className="lg:col-span-2">
          <p className="-mt-2 mb-1 font-display text-2xl font-bold">{money(yearRevenue)}</p>
          <LineChart
            title="Monthly sales by channel"
            labels={monthLabels}
            format="money"
            height={250}
            series={[
              { key: "website", label: "Website sales", color: SERIES_COLORS[0], values: trends.map((t) => t.websiteMinor) },
              { key: "other", label: "Facebook, phone & other sales", color: SERIES_COLORS[1], values: trends.map((t) => t.otherMinor) },
            ]}
          />
        </DashCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard title="Suppliers" className="lg:row-span-2">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#1570ef] text-white">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <p className="font-display text-2xl font-bold">{String(catalog.suppliers.total).padStart(2, "0")}</p>
            <div className="ml-auto space-y-1.5">
              <StatBadge label="Active" value={catalog.suppliers.active} tone="green" />
              <StatBadge label="Inactive" value={catalog.suppliers.inactive} tone="red" />
            </div>
          </div>
          <h3 className="mt-5 text-xs text-muted-foreground">Top suppliers (by purchase orders)</h3>
          {catalog.suppliers.top.length ? (
            <div className="mt-1.5 flex">
              {catalog.suppliers.top.map((s) => (
                <Initials key={s.id} name={s.name} title={`${s.name}: ${s.purchaseOrders} purchase order${s.purchaseOrders === 1 ? "" : "s"}`} />
              ))}
            </div>
          ) : (
            <NotTracked>No purchase orders yet.</NotTracked>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/admin/purchasing/suppliers" className="rounded-full bg-[#1570ef] py-2.5 text-center text-sm font-semibold text-white hover:bg-[#175cd3]">
              All suppliers
            </Link>
            <Link href="/admin/purchasing" className="rounded-full bg-[#b2d1fb] py-2.5 text-center text-sm font-semibold text-[#0b4fb3] hover:bg-[#9cc4fa]">
              Purchase orders
            </Link>
          </div>
        </DashCard>
        <CountCard
          icon={<Boxes className="size-5" aria-hidden="true" />}
          title="Total products"
          value={catalog.products.total}
          href="/admin/catalog/products"
          rows={
            <>
              <StatBadge label="Published" value={catalog.products.active} tone="blue" />
              <StatBadge label="Draft" value={catalog.products.draft} tone="green" />
            </>
          }
        />
        <CountCard
          icon={<Award className="size-5" aria-hidden="true" />}
          title="Total brands"
          value={catalog.brands.total}
          href="/admin/catalog/brands"
          rows={
            <>
              <StatBadge label="Active" value={catalog.brands.active} tone="blue" />
              <StatBadge label="Hidden" value={catalog.brands.hidden} tone="green" />
            </>
          }
        />
        <CountCard
          icon={<LayoutGrid className="size-5" aria-hidden="true" />}
          title="Total categories"
          value={catalog.categories.total}
          href="/admin/catalog/categories"
          rows={
            <>
              <StatBadge label="Top level" value={catalog.categories.topLevel} tone="blue" />
              <StatBadge label="Sub-categories" value={catalog.categories.sub} tone="green" />
            </>
          }
        />
        <CountCard
          icon={<PackageX className="size-5" aria-hidden="true" />}
          title="Out of stock"
          value={catalog.stock.outOfStock}
          href="/admin/inventory?filter=out"
          rows={
            <>
              <StatBadge label="Out of stock" value={catalog.stock.outOfStock} tone="red" />
              <StatBadge label="Low stock" value={catalog.stock.lowStock} tone="green" />
            </>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard title="Top performing categories" action={<RangeMenu param="cats" value={ranges.cats} params={params} />}>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="py-2 font-medium">#</th>
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 text-right font-medium">Units sold</th>
                <th scope="col" className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.length ? (
                topCategories.map((c, i) => (
                  <tr key={c.name} className="border-b border-border/60">
                    <td className="py-3">{i + 1}.</td>
                    <td className="py-3">{c.name}</td>
                    <td className="py-3 text-right tabular-nums">{count(c.units)}</td>
                    <td className="py-3 text-right tabular-nums">{money(c.revenueMinor)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No sales in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DashCard>
        <DashCard title="Top selling products" className="lg:col-span-2" action={<RangeMenu param="prods" value={ranges.prods} params={params} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 font-medium">#</th>
                  <th scope="col" className="py-2 font-medium">Image</th>
                  <th scope="col" className="py-2 font-medium">Product</th>
                  <th scope="col" className="py-2 text-right font-medium">Units sold</th>
                  <th scope="col" className="py-2 text-right font-medium">Rating</th>
                  <th scope="col" className="py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length ? (
                  topProducts.map((p, i) => (
                    <tr key={p.productId ?? p.title} className="border-b border-border/60">
                      <td className="py-2.5">{i + 1}.</td>
                      <td className="py-2.5">
                        <span className="flex size-11 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <Boxes className="size-4 text-subtle-foreground" aria-hidden="true" />
                          )}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {p.productId ? (
                          <Link href={`/admin/catalog/products/${p.productId}`} className="hover:underline">
                            {p.title}
                          </Link>
                        ) : (
                          p.title
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{count(p.units)}</td>
                      <td className="py-2.5 text-right text-muted-foreground" title="Product reviews are not built yet">
                        —
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{money(p.revenueMinor)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No sales in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DashCard>
      </div>
    </>
  );
}

export default function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
