import { ImageOff, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/display";
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { listAdminProducts, type AdminProductFilters } from "@/modules/catalog/admin-queries";
import { listCategoryTree } from "@/modules/catalog/category.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { BulkProductsForm } from "./bulk-form";

export const metadata: Metadata = { title: "Products" };

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

const statusBadge = { ACTIVE: <Badge tone="success">Published</Badge>, DRAFT: <Badge>Draft</Badge>, ARCHIVED: <Badge tone="warning">Archived</Badge> };

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

async function Products({ searchParams }: Pick<PageProps<"/admin/catalog/products">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "catalog.view")) return <AccessDenied permission="catalog.view" />;
  const sp = await searchParams;
  const status = first(sp.status);
  const filters: AdminProductFilters = {
    q: first(sp.q),
    status: status === "ACTIVE" || status === "DRAFT" || status === "ARCHIVED" ? status : undefined,
    categoryId: first(sp.category),
    page: Number(first(sp.page) ?? 1) || 1,
  };
  const [result, categories] = await Promise.all([listAdminProducts(actor, filters), listCategoryTree(actor)]);
  const bulkActions = [
    ...(can(actor, "catalog.publish") ? [{ value: "publish", label: "Publish" }, { value: "unpublish", label: "Unpublish" }] : []),
    ...(can(actor, "catalog.archive") ? [{ value: "archive", label: "Archive" }] : []),
  ];
  const query = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: filters.q, status: filters.status, category: filters.categoryId, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/catalog/products${s ? `?${s}` : ""}`;
  };
  const allCount = (result.statusCounts.ACTIVE ?? 0) + (result.statusCounts.DRAFT ?? 0);

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Every product across all categories."
        actions={
          <>
            {can(actor, "catalog.import") || can(actor, "catalog.export") ? (
              <Link href="/admin/catalog/products/import" className={buttonVariants({ variant: "outline" })}>Import / export</Link>
            ) : null}
            {can(actor, "catalog.create") ? (
              <Link href="/admin/catalog/products/new" className={buttonVariants()}>
                <Plus /> Add product
              </Link>
            ) : null}
          </>
        }
      />
      {sp.deleted ? <Alert tone="success" className="mb-4">Draft deleted.</Alert> : null}

      <nav aria-label="Product status" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {STATUS_TABS.map((t) => {
          const active = (filters.status ?? "") === t.value;
          const count = t.value ? (result.statusCounts[t.value] ?? 0) : allCount;
          return (
            <Link
              key={t.value}
              href={query({ status: t.value || undefined, page: undefined })}
              aria-current={active ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t.label} <span className="text-xs text-subtle-foreground">{count}</span>
            </Link>
          );
        })}
      </nav>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search" aria-label="Filter products">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label htmlFor="product-q" className="sr-only">Search products</label>
        <Input id="product-q" name="q" placeholder="Search title, SKU or barcode" defaultValue={filters.q ?? ""} className="sm:w-72" />
        <label htmlFor="product-category" className="sr-only">Category</label>
        <Select id="product-category" name="category" defaultValue={filters.categoryId ?? ""} className="sm:w-56">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{"  ".repeat(c.depth)}{c.name}</option>)}
        </Select>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>Filter</button>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState
          title={filters.q || filters.categoryId ? "No products match" : "No products yet"}
          description={filters.q || filters.categoryId ? "Try a different search or category." : "Create your first product, or import a CSV."}
          action={can(actor, "catalog.create") ? <Link href="/admin/catalog/products/new" className={buttonVariants()}>Add product</Link> : undefined}
        />
      ) : (
        <BulkProductsForm actions={bulkActions}>
          <Card>
            <Table>
              <THead>
                <tr>
                  {bulkActions.length ? <Th className="w-10"><span className="sr-only">Select</span></Th> : null}
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Variants</Th>
                  <Th>Updated</Th>
                </tr>
              </THead>
              <TBody>
                {result.rows.map((p) => (
                  <Tr key={p.id}>
                    {bulkActions.length ? (
                      <Td><Checkbox name="productIds" value={p.id} aria-label={`Select ${p.title}`} /></Td>
                    ) : null}
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-muted text-subtle-foreground">
                          {p.media[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(p.media[0].storageKey)} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-4" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <Link href={`/admin/catalog/products/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                          {p.brand ? <p className="text-xs text-muted-foreground">{p.brand.name}</p> : null}
                        </div>
                      </div>
                    </Td>
                    <Td>{statusBadge[p.status]}</Td>
                    <Td className="text-muted-foreground">{p.primaryCategory.name}</Td>
                    <Td className="text-right tabular-nums">{p.priceFromMinor !== null ? formatMoney(p.priceFromMinor) : "—"}</Td>
                    <Td className="text-right tabular-nums">{p._count.variants}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        </BulkProductsForm>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {result.page} of {result.pageCount} · {result.total} products</p>
          <div className="flex gap-2">
            {result.page > 1 ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={query({ page: String(result.page - 1) })}>Previous</Link> : null}
            {result.page < result.pageCount ? <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={query({ page: String(result.page + 1) })}>Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

export default function ProductsPage({ searchParams }: PageProps<"/admin/catalog/products">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}
