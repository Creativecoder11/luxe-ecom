import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getBusinessId } from "@/modules/business/context";
import { listOrdersForUser } from "@/modules/checkout/checkout.service";
import { requireCustomer } from "@/modules/identity/session";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";

export const metadata: Metadata = { title: "My orders" };

async function Orders() {
  const user = await requireCustomer("/account/orders");
  const orders = await listOrdersForUser(await getBusinessId(), user.id);
  if (orders.length === 0) {
    return <EmptyState icon={<Package />} title="No orders yet" description="Orders you place appear here." action={<Link href="/shop" className={buttonVariants({ variant: "outline" })}>Start shopping</Link>} />;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My orders</h2>
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/account/orders/${o.number}`} className="font-mono font-semibold hover:underline">{o.number}</Link>
                <p className="text-sm text-muted-foreground">
                  {formatDate(o.placedAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                <span className="font-semibold tabular-nums">{formatMoney(o.totalMinor)}</span>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <Orders />
    </Suspense>
  );
}
