import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { Alert } from "@/components/ui/display";
import { minorToInput } from "@/modules/catalog/admin-queries";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listPurchasableVariants, listSuppliers } from "@/modules/purchasing/purchasing.service";
import { NewPurchaseOrderForm } from "../po-forms";

export const metadata: Metadata = { title: "New purchase order" };

async function NewPurchaseOrder() {
  const actor = await requireStaff();
  if (!can(actor, "purchasing.manage")) return <AccessDenied permission="purchasing.manage" />;
  const [suppliers, variants] = await Promise.all([listSuppliers(actor), listPurchasableVariants(actor)]);
  return (
    <>
      <AdminPageHeader title="New purchase order" description="Saved as a draft; an approver places it with the supplier." />
      {suppliers.length === 0 ? (
        <Alert tone="warning">Add a supplier first. <Link href="/admin/purchasing/suppliers?new" className="underline">Add supplier</Link></Alert>
      ) : (
        <NewPurchaseOrderForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          variants={variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku, cost: minorToInput(v.costMinor) }))}
        />
      )}
    </>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <NewPurchaseOrder />
    </Suspense>
  );
}
