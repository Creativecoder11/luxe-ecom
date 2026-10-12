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
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { minorToInput } from "@/modules/catalog/admin-queries";
import { listCoupons } from "@/modules/checkout/coupon.service";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { CouponForm, type CouponValue } from "./coupon-form";

export const metadata: Metadata = { title: "Coupons" };

const toLocal = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16) : "");

async function Coupons({ searchParams }: Pick<PageProps<"/admin/marketing/coupons">, "searchParams">) {
  const actor = await requireStaff();
  if (!can(actor, "campaigns.manage")) return <AccessDenied permission="campaigns.manage" />;
  const sp = await searchParams;
  const coupons = await listCoupons(actor);
  const editing = typeof sp.edit === "string" ? coupons.find((c) => c.id === sp.edit) : undefined;
  const value: CouponValue | null = editing
    ? {
        id: editing.id,
        code: editing.code,
        description: editing.description ?? "",
        type: editing.type,
        percent: editing.percentBasisPoints ? String(editing.percentBasisPoints / 100) : "",
        amount: minorToInput(editing.amountMinor),
        maxDiscount: minorToInput(editing.maxDiscountMinor),
        minSubtotal: minorToInput(editing.minSubtotalMinor),
        startsAt: toLocal(editing.startsAt),
        endsAt: toLocal(editing.endsAt),
        usageLimit: editing.usageLimit?.toString() ?? "",
        perCustomerLimit: editing.perCustomerLimit?.toString() ?? "",
        isActive: editing.isActive,
      }
    : sp.new !== undefined
      ? { code: "", description: "", type: "PERCENT", percent: "", amount: "", maxDiscount: "", minSubtotal: "", startsAt: "", endsAt: "", usageLimit: "", perCustomerLimit: "", isActive: true }
      : null;
  const describe = (c: (typeof coupons)[number]) =>
    c.type === "PERCENT" ? `${(c.percentBasisPoints ?? 0) / 100}% off${c.maxDiscountMinor ? ` (max ${formatMoney(c.maxDiscountMinor)})` : ""}` : c.type === "FIXED" ? `${formatMoney(c.amountMinor ?? 0)} off` : "Free delivery";
  return (
    <>
      <AdminPageHeader title="Coupons" description="Discount codes customers enter in the cart. Usage limits hold even when many people check out at once." actions={<Link href="?new" className={buttonVariants()}><Plus /> New coupon</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          {coupons.length === 0 ? (
            <EmptyState title="No coupons yet" className="border-0" />
          ) : (
            <Table>
              <THead><tr><Th>Code</Th><Th>Discount</Th><Th className="text-right">Used</Th><Th>Status</Th></tr></THead>
              <TBody>
                {coupons.map((c) => {
                  const expired = c.endsAt && c.endsAt < new Date();
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <Link href={`?edit=${c.id}`} className="font-mono font-semibold hover:underline">{c.code}</Link>
                        {c.endsAt ? <p className="text-xs text-muted-foreground">Ends {formatDate(c.endsAt)}</p> : null}
                      </Td>
                      <Td className="text-sm">{describe(c)}{c.minSubtotalMinor ? <span className="block text-xs text-muted-foreground">Min {formatMoney(c.minSubtotalMinor)}</span> : null}</Td>
                      <Td className="text-right tabular-nums">{c.timesUsed}{c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}</Td>
                      <Td>{!c.isActive ? <Badge>Inactive</Badge> : expired ? <Badge tone="warning">Expired</Badge> : <Badge tone="success">Active</Badge>}</Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
        <div>
          {value ? (
            <Card>
              <CardHeader><CardTitle>{value.id ? `Edit ${value.code}` : "New coupon"}</CardTitle></CardHeader>
              <div className="px-5 pb-5"><CouponForm value={value} /></div>
            </Card>
          ) : (
            <EmptyState title="Select a coupon" description="Choose a coupon to edit, or create a new one." />
          )}
        </div>
      </div>
    </>
  );
}

export default function CouponsPage({ searchParams }: PageProps<"/admin/marketing/coupons">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <Coupons searchParams={searchParams} />
    </Suspense>
  );
}
