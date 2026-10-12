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
import { listBrands } from "@/modules/catalog/brand.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { BrandForm, DeleteBrandButton, type BrandValue } from "./brand-forms";

export const metadata: Metadata = { title: "Brands" };

async function Brands({ searchParams }: Pick<PageProps<"/admin/catalog/brands">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "catalog.view")) return <AccessDenied permission="catalog.view" />;
  const sp = await searchParams;
  const brands = await listBrands(actor);
  const editing = typeof sp.edit === "string" ? brands.find((b) => b.id === sp.edit) : undefined;
  const value: BrandValue | null =
    editing && can(actor, "catalog.update")
      ? { id: editing.id, name: editing.name, slug: editing.slug, description: editing.description ?? "", status: editing.status }
      : sp.new !== undefined && can(actor, "catalog.create")
        ? { name: "", slug: "", description: "", status: "ACTIVE" }
        : null;

  return (
    <>
      <AdminPageHeader
        title="Brands"
        description="Brands appear on product cards, product pages and as storefront filters."
        actions={can(actor, "catalog.create") ? <Link href="?new" className={buttonVariants()}><Plus /> New brand</Link> : null}
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          {brands.length === 0 ? (
            <EmptyState title="No brands yet" className="border-0" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Brand</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Products</Th>
                </tr>
              </THead>
              <TBody>
                {brands.map((b) => (
                  <Tr key={b.id}>
                    <Td>
                      <Link href={`?edit=${b.id}`} className="font-medium hover:underline">{b.name}</Link>
                      <p className="font-mono text-xs text-subtle-foreground">/brands/{b.slug}</p>
                    </Td>
                    <Td>{b.status === "ACTIVE" ? <Badge tone="success">Visible</Badge> : <Badge tone="warning">Hidden</Badge>}</Td>
                    <Td className="text-right tabular-nums">{b._count.products}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div>
          {value ? (
            <Card>
              <CardHeader>
                <CardTitle>{value.id ? `Edit “${value.name}”` : "New brand"}</CardTitle>
              </CardHeader>
              <div className="space-y-6 px-5 pb-5">
                <BrandForm value={value} />
                {value.id && can(actor, "catalog.delete") ? <DeleteBrandButton brandId={value.id} /> : null}
              </div>
            </Card>
          ) : (
            <EmptyState title="Select a brand" description="Choose a brand to edit, or create a new one." />
          )}
        </div>
      </div>
    </>
  );
}

export default function BrandsPage({ searchParams }: PageProps<"/admin/catalog/brands">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Brands searchParams={searchParams} />
    </Suspense>
  );
}
