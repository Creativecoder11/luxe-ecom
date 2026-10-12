import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { OrderSummary } from "@/components/storefront/order-summary";
import { Badge, Card, CardHeader, CardTitle } from "@/components/ui/display";
import { NotFoundError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { can } from "@/modules/identity/actor";
import { requireStaff } from "@/modules/identity/session";
import { getAdminOrder } from "@/modules/orders/admin-orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, SOURCE_LABEL } from "@/modules/orders/labels";

export const metadata: Metadata = { title: "Order" };

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff();
  if (!can(actor, "orders.view")) return <AccessDenied permission="orders.view" />;
  const order = await getAdminOrder(actor, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const a = order.addressDisplay;
  return (
    <>
      <AdminPageHeader
        title={order.number}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status]}</Badge>{SOURCE_LABEL[order.source]} · {formatDateTime(order.placedAt)}</span>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="p-5"><OrderSummary order={order} /></Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <div className="space-y-1 px-5 pb-5 text-sm">
              <p className="font-medium">{order.contactName}</p>
              <p className="font-mono">{order.contactPhoneDisplay}</p>
              {order.contactEmailDisplay ? <p>{order.contactEmailDisplay}</p> : null}
              <p className="pt-2 text-muted-foreground">{a.addressLine}{a.area ? `, ${a.area}` : ""}</p>
              <p className="text-muted-foreground">{a.upazila}, {a.districtName} · {order.shippingZoneName}</p>
              {order.customerNote ? <p className="pt-2">Note: {order.customerNote}</p> : null}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <p className="px-5 pb-5 text-sm">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
          </Card>
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <ol className="space-y-2 px-5 pb-5 text-sm">
              {order.history.map((h) => (
                <li key={h.id}><span className="font-medium">{ORDER_STATUS_LABEL[h.toStatus]}</span> <span className="text-muted-foreground">· {formatDateTime(h.createdAt)}{h.note ? ` · ${h.note}` : ""}</span></li>
              ))}
            </ol>
          </Card>
          <Link href="/admin/orders" className="text-sm text-muted-foreground hover:underline">← All orders</Link>
        </div>
      </div>
    </>
  );
}

export default function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}
