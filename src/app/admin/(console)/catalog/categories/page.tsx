import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { cn } from "@/lib/utils/cn";
import { listAttributes } from "@/modules/catalog/attribute.service";
import { getCategory, listCategoryTree } from "@/modules/catalog/category.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { CategoryEditor, type CategoryFormValue } from "./category-editor";

export const metadata: Metadata = { title: "Categories" };

async function Categories({ searchParams }: Pick<PageProps<"/admin/catalog/categories">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "catalog.view")) return <AccessDenied permission="catalog.view" />;
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;
  const creating = sp.new !== undefined;
  const [tree, attributes] = await Promise.all([listCategoryTree(actor), listAttributes(actor)]);
  const editing = editId && tree.some((c) => c.id === editId) ? await getCategory(actor, editId) : null;
  const canWrite = editing ? can(actor, "catalog.update") : can(actor, "catalog.create");

  const value: CategoryFormValue | null = editing
    ? {
        id: editing.id,
        name: editing.name,
        slug: editing.slug,
        parentId: editing.parentId ?? "",
        description: editing.description ?? "",
        status: editing.status,
        sortOrder: editing.sortOrder,
        defaultTrackingMode: editing.defaultTrackingMode,
        attributes: editing.attributes.map((a) => ({ attributeId: a.attributeId, isRequired: a.isRequired })),
      }
    : creating
      ? { name: "", slug: "", parentId: typeof sp.parent === "string" ? sp.parent : "", description: "", status: "ACTIVE", sortOrder: 0, defaultTrackingMode: "NONE", attributes: [] }
      : null;

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="A tree of categories, each with an attribute template for its products."
        actions={can(actor, "catalog.create") ? <Link href="?new" className={buttonVariants()}><Plus /> New category</Link> : null}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          {tree.length === 0 ? (
            <EmptyState title="No categories yet" description="Create top-level categories such as Beauty, Fashion or Gadgets." className="border-0" />
          ) : (
            <ul className="divide-y divide-border" aria-label="Category tree">
              {tree.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`?edit=${c.id}`}
                    aria-current={editId === c.id ? "true" : undefined}
                    className={cn("flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted", editId === c.id && "bg-accent-soft")}
                    style={{ paddingLeft: `${1 + c.depth * 1.25}rem` }}
                  >
                    <span className="flex-1 font-medium">{c.name}</span>
                    {c.status === "HIDDEN" ? <Badge tone="warning">Hidden</Badge> : null}
                    <span className="text-xs text-subtle-foreground">{c.productCount} {c.productCount === 1 ? "product" : "products"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div>
          {value && canWrite ? (
            <CategoryEditor
              key={value.id ?? "new"}
              value={value}
              parents={tree}
              attributes={attributes.map((a) => ({ id: a.id, label: a.label, code: a.code, type: a.type, isVariantAxis: a.isVariantAxis }))}
              canDelete={can(actor, "catalog.delete")}
            />
          ) : (
            <EmptyState title="Select a category" description="Choose a category to edit its details and attribute template." />
          )}
        </div>
      </div>
    </>
  );
}

export default function CategoriesPage({ searchParams }: PageProps<"/admin/catalog/categories">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Categories searchParams={searchParams} />
    </Suspense>
  );
}
