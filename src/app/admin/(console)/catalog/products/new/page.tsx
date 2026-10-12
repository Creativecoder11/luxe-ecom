import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { Alert } from "@/components/ui/display";
import { getProductEditorData } from "@/modules/catalog/admin-queries";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = { title: "New product" };

async function NewProduct() {
  const actor = await requireStaff();
  if (!can(actor, "catalog.create")) return <AccessDenied permission="catalog.create" />;
  const data = await getProductEditorData(actor);
  return (
    <>
      <AdminPageHeader title="New product" description="Saved as a draft. Publish it when it is ready for customers." />
      {data.categories.length === 0 ? (
        <Alert tone="warning">Create a category first: products need a category to know which details apply.</Alert>
      ) : (
        <ProductEditor {...data} canEdit />
      )}
    </>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewProduct />
    </Suspense>
  );
}
