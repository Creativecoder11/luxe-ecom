import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import / export products" };

const COLUMNS: [string, string][] = [
  ["product_slug *", "Groups rows into one product. Existing slugs are updated, new ones created."],
  ["title *", "Product title."],
  ["category_slug *", "Primary category; decides which attributes and variant options apply."],
  ["brand_slug", "Optional brand."],
  ["status", "published or draft (empty keeps the current status for updates, draft for new products)."],
  ["description, base_sku", "Optional product fields."],
  ["sku *, price *", "One row per variant. Price in taka, e.g. 1250 or 1250.50."],
  ["compare_at, cost, barcode, weight_grams, variant_active", "Optional variant fields (variant_active: true/false)."],
  ["option:<code>", "Variant option for the row, e.g. option:size = M, option:shade = Ruby Red."],
  ["attr:<code>", "Product detail, e.g. attr:volume_ml = 30. Multiple choices separated by |."],
];

async function ImportExport() {
  const actor = await requireStaff();
  const canImport = can(actor, "catalog.import");
  const canExport = can(actor, "catalog.export");
  if (!canImport && !canExport) return <AccessDenied permission="catalog.import" />;
  return (
    <>
      <AdminPageHeader title="Import / export products" description="Bulk-edit the catalog with a spreadsheet: one row per variant." />
      <div className="grid gap-6 xl:grid-cols-2">
        {canExport ? (
          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Downloads every non-archived product. The file doubles as an import template.</CardDescription>
            </CardHeader>
            <div className="px-5 pb-5">
              {/* A file download from a route handler: a plain anchor avoids client navigation and prefetching. */}
              <a href="/admin/catalog/products/export" download className={buttonVariants({ variant: "outline" })}>
                <Download /> Download CSV
              </a>
            </div>
          </Card>
        ) : null}
        {canImport ? (
          <Card>
            <CardHeader>
              <CardTitle>Import</CardTitle>
              <CardDescription>Check the file first; errors are listed by line number.</CardDescription>
            </CardHeader>
            <div className="px-5 pb-5">
              <ImportForm />
            </div>
          </Card>
        ) : null}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Columns</CardTitle>
          <CardDescription>* required. Categories, brands, attributes and options must already exist.</CardDescription>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <Th>Column</Th>
              <Th>Meaning</Th>
            </tr>
          </THead>
          <TBody>
            {COLUMNS.map(([column, meaning]) => (
              <Tr key={column}>
                <Td className="font-mono text-xs whitespace-nowrap">{column}</Td>
                <Td className="text-muted-foreground">{meaning}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export default function ImportExportPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ImportExport />
    </Suspense>
  );
}
