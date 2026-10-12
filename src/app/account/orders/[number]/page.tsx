import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderSummary } from "@/components/storefront/order-summary";
import { Badge, Card, Skeleton } from "@/components/ui/display";
import { formatDateTime } from "@/lib/format";
import { getBusinessId } from "@/modules/business/context";
import { getOrderForUser } from "@/modules/checkout/checkout.service";
import { requireCustomer } from "@/modules/identity/session";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL } from "@/modules/orders/labels";

export const metadata: Metadata = { title: "Order details" };

async function OrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireCustomer("/account/orders");
  // Ownership is enforced in the query: other customers' orders are simply not found (IDOR-safe).
  const order = await getOrderForUser(await getBusinessId(), user.id, decodeURIComponent(number));
  if (!order) notFound();
  const address = order.shippingAddress as { recipientName: string; districtName: string; upazila: string; area: string | null; addressLine: string };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">← My orders</Link>
          <h2 className="mt-1 font-mono text-xl font-semibold">{order.number}</h2>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-5"><OrderSummary order={order} /></Card>
        <div className="space-y-6">
          <Card className="space-y-1 p-5 text-sm">
            <h3 className="mb-2 font-semibold">Delivery</h3>
            <p>{address.recipientName}</p>
            <p className="text-muted-foreground">{address.addressLine}{address.area ? `, ${address.area}` : ""}</p>
            <p className="text-muted-foreground">{address.upazila}, {address.districtName}</p>
          </Card>
          <Card className="p-5 text-sm">
            <h3 className="mb-2 font-semibold">Payment</h3>
            <p>{PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
          </Card>
          <Card className="p-5 text-sm">
            <h3 className="mb-3 font-semibold">Progress</h3>
            <ol className="space-y-3">
              {order.history.map((h) => (
                <li key={h.id} className="border-l-2 border-primary pl-3">
                  <p className="font-medium">{ORDER_STATUS_LABEL[h.toStatus]}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}
