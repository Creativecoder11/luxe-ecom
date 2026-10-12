import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/display";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { DISTRICTS, DIVISIONS, findDistrict } from "@/lib/bd-geo";
import { formatMoney } from "@/lib/money";
import { minorToInput } from "@/modules/catalog/admin-queries";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { listShippingZones } from "@/modules/settings/commerce.service";
import { ZoneForm, type ZoneValue } from "./zone-form";

export const metadata: Metadata = { title: "Delivery zones" };

async function Zones({ searchParams }: Pick<PageProps<"/admin/settings/shipping">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "settings.view")) return <AccessDenied permission="settings.view" />;
  const sp = await searchParams;
  const zones = await listShippingZones(actor);
  const editing = typeof sp.edit === "string" ? zones.find((z) => z.id === sp.edit) : undefined;
  const canEdit = can(actor, "settings.manage");
  const value: ZoneValue | null =
    editing && canEdit
      ? {
          id: editing.id,
          name: editing.name,
          isFallback: editing.isFallback,
          districts: editing.districts,
          baseFee: minorToInput(editing.baseFeeMinor),
          includedWeightGrams: String(editing.includedWeightGrams),
          extraPerKg: minorToInput(editing.extraPerKgMinor),
          freeShippingThreshold: minorToInput(editing.freeShippingThresholdMinor),
          codEnabled: editing.codEnabled,
          codFee: minorToInput(editing.codFeeMinor),
          estimate: editing.estimate ?? "",
          isActive: editing.isActive,
          sortOrder: String(editing.sortOrder),
        }
      : sp.new !== undefined && canEdit
        ? { name: "", isFallback: false, districts: [], baseFee: "", includedWeightGrams: "1000", extraPerKg: "", freeShippingThreshold: "", codEnabled: true, codFee: "", estimate: "", isActive: true, sortOrder: "0" }
        : null;
  const takenBy = new Map<string, string>();
  for (const z of zones) if (z.isActive && z.id !== value?.id) for (const d of z.districts) takenBy.set(d, z.name);
  const divisions = DIVISIONS.map((division) => ({
    division,
    districts: DISTRICTS.filter((d) => d.division === division).map((d) => ({ code: d.code, name: d.name, takenBy: takenBy.get(d.code) ?? null })),
  }));
  const hasFallback = zones.some((z) => z.isFallback && z.isActive);

  return (
    <>
      <AdminPageHeader
        title="Delivery zones and fees"
        description="Group districts into zones with their own delivery fee, weight pricing, free-delivery threshold and COD rules."
        actions={canEdit ? <Link href="?new" className={buttonVariants()}><Plus /> New zone</Link> : null}
      />
      {!hasFallback ? (
        <Alert tone="warning" className="mb-4">No active “rest of Bangladesh” zone: customers in districts outside your zones cannot order.</Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          {zones.length === 0 ? (
            <EmptyState title="No delivery zones yet" className="border-0" description="Create e.g. “Inside Dhaka” and a “Rest of Bangladesh” zone to start taking orders." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Zone</Th>
                  <Th className="text-right">Fee</Th>
                  <Th>COD</Th>
                </tr>
              </THead>
              <TBody>
                {zones.map((z) => (
                  <Tr key={z.id}>
                    <Td>
                      <Link href={`?edit=${z.id}`} className="font-medium hover:underline">{z.name}</Link>
                      {!z.isActive ? <Badge className="ml-2">Inactive</Badge> : null}
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {z.isFallback ? "All other districts" : z.districts.map((d) => findDistrict(d)?.name ?? d).join(", ")}
                      </p>
                      {z.estimate ? <p className="text-xs text-subtle-foreground">{z.estimate}</p> : null}
                    </Td>
                    <Td className="text-right text-sm whitespace-nowrap tabular-nums">
                      {formatMoney(z.baseFeeMinor)}
                      <span className="block text-xs text-muted-foreground">up to {z.includedWeightGrams / 1000} kg{z.extraPerKgMinor ? ` · +${formatMoney(z.extraPerKgMinor)}/kg` : ""}</span>
                      {z.freeShippingThresholdMinor !== null ? <span className="block text-xs text-success">Free from {formatMoney(z.freeShippingThresholdMinor)}</span> : null}
                    </Td>
                    <Td>
                      {z.codEnabled ? <Badge tone="success">COD{z.codFeeMinor ? ` +${formatMoney(z.codFeeMinor)}` : ""}</Badge> : <Badge tone="danger">No COD</Badge>}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        <div>{value ? <ZoneForm key={value.id ?? "new"} value={value} divisions={divisions} /> : <EmptyState title="Select a zone" description="Choose a zone to edit its fees and districts." />}</div>
      </div>
    </>
  );
}

export default function ShippingZonesPage({ searchParams }: PageProps<"/admin/settings/shipping">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Zones searchParams={searchParams} />
    </Suspense>
  );
}
