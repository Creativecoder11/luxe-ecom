import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/display";
import { NotFoundError } from "@/lib/errors";
import { getProductEditorData } from "@/modules/catalog/admin-queries";
import { listProductMedia } from "@/modules/catalog/media.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { ProductLifecycleActions, type LifecycleButton } from "../product-actions";
import { MediaManager } from "../media-manager";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = { title: "Edit product" };

async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PageProps<"/admin/catalog/products/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const actor = await requireStaff();
  if (!can(actor, "catalog.view")) return <AccessDenied permission="catalog.view" />;
  const data = await getProductEditorData(actor, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const product = data.product!;
  const media = await listProductMedia(actor, product.id);

  const buttons: LifecycleButton[] = [];
  if (product.status === "DRAFT" && can(actor, "catalog.publish")) buttons.push({ action: "publish", label: "Publish", variant: "primary" });
  if (product.status === "ACTIVE" && can(actor, "catalog.publish")) buttons.push({ action: "unpublish", label: "Unpublish", confirm: "Hide this product from the store?" });
  if (can(actor, "catalog.create")) buttons.push({ action: "duplicate", label: "Duplicate" });
  if (product.status !== "ARCHIVED" && can(actor, "catalog.archive")) buttons.push({ action: "archive", label: "Archive", variant: "ghost", confirm: "Archive this product? It is hidden from the store and kept for history." });
  if (product.status === "ARCHIVED" && can(actor, "catalog.archive")) buttons.push({ action: "restore", label: "Restore", variant: "primary" });
  if (product.status === "DRAFT" && !product.firstPublishedAt && can(actor, "catalog.delete")) {
    buttons.push({ action: "delete", label: "Delete draft", variant: "danger", confirm: "Permanently delete this draft? This cannot be undone." });
  }

  return (
    <>
      <AdminPageHeader
        title={product.title}
        description={
          <span className="flex items-center gap-2">
            {product.status === "ACTIVE" ? <Badge tone="success">Published</Badge> : product.status === "ARCHIVED" ? <Badge tone="warning">Archived</Badge> : <Badge>Draft</Badge>}
            <span className="font-mono text-xs">/products/{product.slug}</span>
          </span>
        }
        actions={
          product.status === "ACTIVE" ? (
            <Link href={`/products/${product.slug}`} className={buttonVariants({ variant: "outline" })} target="_blank">
              <ExternalLink /> View in store
            </Link>
          ) : null
        }
      />
      {sp.created ? <Alert tone="success" className="mb-4">Draft created. Publish it when it is ready.</Alert> : null}
      {sp.duplicated ? <Alert tone="success" className="mb-4">Copy created as a draft. Review SKUs and the title before publishing.</Alert> : null}
      <div className="mb-6">
        <ProductLifecycleActions productId={product.id} buttons={buttons} />
      </div>
      <div className="mb-6">
        <MediaManager
          productId={product.id}
          items={media.map((m) => ({ id: m.id, storageKey: m.storageKey, alt: m.alt, width: m.width, height: m.height }))}
          canEdit={can(actor, "catalog.update") && product.status !== "ARCHIVED"}
        />
      </div>
      <ProductEditor {...data} canEdit={can(actor, "catalog.update")} />
    </>
  );
}

export default function EditProductPage({ params, searchParams }: PageProps<"/admin/catalog/products/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <EditProduct params={params} searchParams={searchParams} />
    </Suspense>
  );
}
