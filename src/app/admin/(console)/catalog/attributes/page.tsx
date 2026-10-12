import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { AttributeValidationRules } from "@/modules/catalog/attributes";
import { getAttribute, listAttributes } from "@/modules/catalog/attribute.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { AttributeEditor, type AttributeFormValue } from "./attribute-editor";

export const metadata: Metadata = { title: "Attributes" };

const TYPE_LABELS: Record<string, string> = { TEXT: "Text", NUMBER: "Number", DATE: "Date", BOOLEAN: "Yes / no", SELECT: "Single choice", MULTI_SELECT: "Multiple choice" };

async function Attributes({ searchParams }: Pick<PageProps<"/admin/catalog/attributes">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "catalog.view")) return <AccessDenied permission="catalog.view" />;
  const sp = await searchParams;
  const attributes = await listAttributes(actor);
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;
  const editing = editId && attributes.some((a) => a.id === editId) ? await getAttribute(actor, editId) : null;

  let value: AttributeFormValue | null = null;
  if (editing && can(actor, "catalog.update")) {
    const rules = (editing.validation as AttributeValidationRules | null) ?? {};
    value = {
      id: editing.id,
      code: editing.code,
      label: editing.label,
      type: editing.type,
      unit: editing.unit ?? "",
      helpText: editing.helpText ?? "",
      isVariantAxis: editing.isVariantAxis,
      isFilterable: editing.isFilterable,
      isSearchable: editing.isSearchable,
      min: rules.min?.toString() ?? "",
      max: rules.max?.toString() ?? "",
      integer: rules.integer ?? false,
      maxLength: rules.maxLength?.toString() ?? "",
      options: editing.options.map((o) => ({ id: o.id, label: o.label, colorHex: o.colorHex ?? "" })),
      inUse: editing._count.productValues + editing._count.variantValues > 0,
    };
  } else if (sp.new !== undefined && can(actor, "catalog.create")) {
    value = { code: "", label: "", type: "SELECT", unit: "", helpText: "", isVariantAxis: false, isFilterable: false, isSearchable: false, min: "", max: "", integer: false, maxLength: "", options: [], inUse: false };
  }

  return (
    <>
      <AdminPageHeader
        title="Attributes"
        description="Typed product details shared across categories: sizes, shades, specifications and more."
        actions={can(actor, "catalog.create") ? <Link href="?new" className={buttonVariants()}><Plus /> New attribute</Link> : null}
      />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          {attributes.length === 0 ? (
            <EmptyState title="No attributes yet" className="border-0" description="Create attributes such as Size, Shade or Warranty, then add them to category templates." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Attribute</Th>
                  <Th>Type</Th>
                  <Th>Use</Th>
                  <Th className="text-right">Categories</Th>
                </tr>
              </THead>
              <TBody>
                {attributes.map((a) => (
                  <Tr key={a.id} className={editId === a.id ? "bg-accent-soft" : undefined}>
                    <Td>
                      <Link href={`?edit=${a.id}`} className="font-medium hover:underline">{a.label}</Link>
                      <p className="font-mono text-xs text-subtle-foreground">{a.code}{a.unit ? ` · ${a.unit}` : ""}</p>
                      {a.options.length ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.options.map((o) => o.label).join(", ")}</p> : null}
                    </Td>
                    <Td className="text-muted-foreground">{TYPE_LABELS[a.type]}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {a.isVariantAxis ? <Badge tone="primary">Variant</Badge> : null}
                        {a.isFilterable ? <Badge tone="info">Filter</Badge> : null}
                        {a.isSearchable ? <Badge>Search</Badge> : null}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{a._count.categories}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div>
          {value ? (
            <AttributeEditor key={value.id ?? "new"} value={value} canArchive={can(actor, "catalog.archive")} />
          ) : (
            <EmptyState title="Select an attribute" description="Choose an attribute to edit, or create a new one." />
          )}
        </div>
      </div>
    </>
  );
}

export default function AttributesPage({ searchParams }: PageProps<"/admin/catalog/attributes">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Attributes searchParams={searchParams} />
    </Suspense>
  );
}
