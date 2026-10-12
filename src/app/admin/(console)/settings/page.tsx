import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { minorToInput } from "@/modules/catalog/admin-queries";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listTaxClasses } from "@/modules/settings/commerce.service";
import { getCommerceSettingsForStore } from "@/modules/settings/store-settings";
import { CommerceSettingsForm, TaxClassForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

function percent(bp: number) {
  return bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2).replace(/0$/, "");
}

async function Settings() {
  const actor = await requireStaff();
  if (!can(actor, "settings.view")) return <AccessDenied permission="settings.view" />;
  const [settings, taxClasses] = await Promise.all([getCommerceSettingsForStore(actor.businessId), listTaxClasses(actor)]);
  const canEdit = can(actor, "settings.manage");
  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="VAT, Cash on Delivery and checkout rules. Changes apply to new orders; placed orders keep their totals."
        actions={<Link href="/admin/settings/shipping" className={buttonVariants({ variant: "outline" })}><Truck /> Delivery zones and fees</Link>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VAT and checkout</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5">
            <CommerceSettingsForm
              canEdit={canEdit}
              value={{
                pricesIncludeTax: settings.pricesIncludeTax,
                vatRegistrationNumber: settings.vatRegistrationNumber ?? "",
                codEnabled: settings.codEnabled,
                codMaxOrder: minorToInput(settings.codMaxOrderMinor),
                guestCheckoutEnabled: settings.guestCheckoutEnabled,
                lowStockThreshold: String(settings.lowStockThreshold),
              }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>VAT rates (tax classes)</CardTitle>
            <CardDescription>Assign a tax class to each product; products without one use the default. Set the rates your business is registered for.</CardDescription>
          </CardHeader>
          <div className="space-y-5 px-5 pb-5">
            {taxClasses.map((t) => (
              <div key={t.id} className="space-y-1">
                {canEdit ? (
                  <TaxClassForm value={{ id: t.id, name: t.name, code: t.code, ratePercent: percent(t.rateBasisPoints), isDefault: t.isDefault }} />
                ) : (
                  <p className="text-sm">{t.name}: {percent(t.rateBasisPoints)}%{t.isDefault ? " (default)" : ""}</p>
                )}
                <p className="text-xs text-subtle-foreground">{t._count.products} product(s) assigned</p>
              </div>
            ))}
            {canEdit ? (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium">Add a tax class</p>
                <TaxClassForm value={{ name: "", code: "", ratePercent: "", isDefault: false }} />
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Settings />
    </Suspense>
  );
}
