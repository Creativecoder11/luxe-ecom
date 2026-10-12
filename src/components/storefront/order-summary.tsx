import { formatMoney } from "@/lib/money";

interface OrderLike {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  pricesIncludeTax: boolean;
  totalMinor: number;
  couponCode: string | null;
  items: { id: string; productTitle: string; variantTitle: string; quantity: number; lineTotalMinor: number; sku: string }[];
}

/** Line items and totals exactly as stored on the order (snapshots, never recomputed). */
export function OrderSummary({ order }: { order: OrderLike }) {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 py-2">
            <span>
              {i.productTitle}
              {i.variantTitle ? <span className="text-muted-foreground"> · {i.variantTitle}</span> : null}
              <span className="text-muted-foreground"> × {i.quantity}</span>
            </span>
            <span className="tabular-nums">{formatMoney(i.lineTotalMinor)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotalMinor)}</dd></div>
        {order.discountMinor > 0 ? <div className="flex justify-between text-success"><dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd className="tabular-nums">−{formatMoney(order.discountMinor)}</dd></div> : null}
        <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor)}</dd></div>
        {order.codFeeMinor > 0 ? <div className="flex justify-between"><dt>COD charge</dt><dd className="tabular-nums">{formatMoney(order.codFeeMinor)}</dd></div> : null}
        {order.taxMinor > 0 ? <div className="flex justify-between text-muted-foreground"><dt>{order.pricesIncludeTax ? "VAT included" : "VAT"}</dt><dd className="tabular-nums">{formatMoney(order.taxMinor)}</dd></div> : null}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totalMinor)}</dd></div>
      </dl>
    </div>
  );
}
