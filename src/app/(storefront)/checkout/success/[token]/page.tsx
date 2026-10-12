import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderSummary } from "@/components/storefront/order-summary";
import { buttonVariants } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/display";
import { formatMoney } from "@/lib/money";
import { maskPhone } from "@/lib/phone";
import { getBusinessId } from "@/modules/business/context";
import { getOrderByPublicToken } from "@/modules/checkout/checkout.service";

export const metadata: Metadata = { title: "Order placed", robots: { index: false, follow: false } };

async function Confirmation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByPublicToken(await getBusinessId(), token);
  if (!order) notFound();
  const address = order.shippingAddress as { recipientName: string; districtName: string; upazila: string; area: string | null; addressLine: string };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <CircleCheck className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-bold">Thank you, your order is placed</h1>
        <p className="mt-2 text-muted-foreground">
          Order <span className="font-mono font-semibold text-foreground">{order.number}</span>. Our team will contact you at {maskPhone(order.contactPhoneE164)} to confirm it before dispatch.
        </p>
      </div>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Order details</h2>
        <OrderSummary order={order} />
        <p className="rounded-lg bg-surface-muted p-3 text-sm">
          Please keep <span className="font-semibold">{formatMoney(order.totalMinor)}</span> ready to pay in cash when your order arrives.
        </p>
      </Card>
      <Card className="space-y-1 p-5 text-sm">
        <h2 className="mb-2 font-semibold">Delivering to</h2>
        <p>{address.recipientName}</p>
        <p className="text-muted-foreground">{address.addressLine}{address.area ? `, ${address.area}` : ""}</p>
        <p className="text-muted-foreground">{address.upazila}, {address.districtName}</p>
      </Card>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>Continue shopping</Link>
        <Link href="/account/orders" className={buttonVariants({ variant: "ghost" })}>My orders</Link>
      </div>
    </div>
  );
}

export default function OrderPlacedPage({ params }: PageProps<"/checkout/success/[token]">) {
  return (
    <div className="px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl rounded-xl" />}>
        <Confirmation params={params} />
      </Suspense>
    </div>
  );
}
