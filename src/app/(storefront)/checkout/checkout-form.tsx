"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, Card } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { formatMoney } from "@/lib/money";
import type { CheckoutQuote } from "@/modules/checkout/checkout.service";
import { placeOrderAction, quoteCheckoutAction } from "./actions";

export interface CheckoutLine {
  key: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  lineTotalMinor: number;
}

interface Props {
  idempotencyKey: string;
  districts: { division: string; options: { code: string; name: string }[] }[];
  lines: CheckoutLine[];
  initialQuote: CheckoutQuote;
  prefill: { name: string; phone: string; email: string; district: string; upazila: string; area: string; addressLine: string };
  couponCode: string | null;
}

export function CheckoutForm({ idempotencyKey, districts, lines, initialQuote, prefill, couponCode }: Props) {
  const [state, formAction] = useActionState(placeOrderAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [district, setDistrict] = useState(echoed(state, "district") ?? prefill.district);
  const [quote, setQuote] = useState<CheckoutQuote>(initialQuote);
  const [quoting, startQuote] = useTransition();

  useEffect(() => {
    if (!district) return;
    startQuote(async () => setQuote(await quoteCheckoutAction(district)));
  }, [district]);

  const canPlace = !!district && quote.deliverable && quote.codAvailable && !quoting;
  const value = (key: keyof Props["prefill"]) => echoed(state, key) ?? prefill[key];

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-[1fr_24rem]" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="paymentMethod" value="COD" />
      <div className="space-y-6">
        <FormAlert state={state} />
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Full name" error={errors.name} required>
              {(aria) => <Input {...aria} name="name" autoComplete="name" defaultValue={value("name")} required />}
            </Field>
            <Field id="phone" label="Mobile number" hint="We'll use this to confirm and deliver your order." error={errors.phone} required>
              {(aria) => <Input {...aria} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={value("phone")} required />}
            </Field>
            <Field id="email" label="Email" hint="Optional" error={errors.email} className="sm:col-span-2">
              {(aria) => <Input {...aria} name="email" type="email" autoComplete="email" defaultValue={value("email")} />}
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Delivery address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="district" label="District" error={errors.district} required>
              {(aria) => (
                <Select {...aria} name="district" value={district} onChange={(e) => setDistrict(e.target.value)} required>
                  <option value="">Choose your district</option>
                  {districts.map((group) => (
                    <optgroup key={group.division} label={`${group.division} division`}>
                      {group.options.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="upazila" label="Upazila / thana" error={errors.upazila} required>
              {(aria) => <Input {...aria} name="upazila" defaultValue={value("upazila")} required />}
            </Field>
            <Field id="area" label="Area" hint="Optional, e.g. Dhanmondi 27" error={errors.area}>
              {(aria) => <Input {...aria} name="area" defaultValue={value("area")} />}
            </Field>
            <Field id="addressLine" label="House, road and landmark" error={errors.addressLine} required>
              {(aria) => <Input {...aria} name="addressLine" autoComplete="street-address" defaultValue={value("addressLine")} required />}
            </Field>
            <Field id="note" label="Note for delivery" hint="Optional" error={errors.note} className="sm:col-span-2">
              {(aria) => <Textarea {...aria} name="note" rows={2} defaultValue={echoed(state, "note") ?? ""} />}
            </Field>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Payment</h2>
          <label className="flex items-start gap-3 rounded-lg border border-primary bg-accent-soft/40 p-4 text-sm">
            <input type="radio" checked readOnly className="mt-0.5 accent-primary" aria-label="Cash on Delivery" />
            <span>
              <span className="block font-medium">Cash on Delivery</span>
              <span className="text-muted-foreground">Pay in cash when your order arrives.</span>
            </span>
          </label>
          {errors.paymentMethod ? <p className="text-xs text-danger">{errors.paymentMethod}</p> : null}
        </Card>
      </div>

      <aside aria-label="Order summary">
        <Card className="space-y-4 p-5 lg:sticky lg:top-28">
          <h2 className="text-lg font-semibold">Your order</h2>
          <ul className="divide-y divide-border text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3 py-2">
                <span>
                  {l.title}
                  {l.variantTitle ? <span className="text-muted-foreground"> · {l.variantTitle}</span> : null}
                  <span className="text-muted-foreground"> × {l.quantity}</span>
                </span>
                <span className="tabular-nums">{formatMoney(l.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-border pt-3 text-sm" aria-live="polite" aria-busy={quoting}>
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(quote.subtotalMinor)}</dd></div>
            {quote.discountMinor > 0 ? (
              <div className="flex justify-between text-success"><dt>Discount{couponCode ? ` (${couponCode})` : ""}</dt><dd className="tabular-nums">−{formatMoney(quote.discountMinor)}</dd></div>
            ) : null}
            <div className="flex justify-between">
              <dt>Delivery{quote.zoneName ? <span className="text-muted-foreground"> · {quote.zoneName}</span> : null}</dt>
              <dd className="tabular-nums">{district && quote.deliverable ? (quote.shippingMinor === 0 ? "Free" : formatMoney(quote.shippingMinor)) : "Choose district"}</dd>
            </div>
            {quote.codFeeMinor > 0 ? <div className="flex justify-between"><dt>COD charge</dt><dd className="tabular-nums">{formatMoney(quote.codFeeMinor)}</dd></div> : null}
            {quote.taxMinor > 0 ? (
              <div className="flex justify-between text-muted-foreground"><dt>{quote.pricesIncludeTax ? "VAT included" : "VAT"}</dt><dd className="tabular-nums">{formatMoney(quote.taxMinor)}</dd></div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <dt>Total to pay on delivery</dt>
              <dd className="tabular-nums">{formatMoney(quote.totalMinor)}</dd>
            </div>
            {quote.estimate && quote.deliverable ? <p className="text-xs text-muted-foreground">Estimated delivery: {quote.estimate}</p> : null}
          </dl>
          {quote.message ? <Alert tone="warning">{quote.message}</Alert> : null}
          <SubmitButton size="lg" className="w-full rounded-full" disabled={!canPlace} pendingLabel="Placing order…">
            Place order
          </SubmitButton>
          <p className="text-center text-xs text-muted-foreground">Totals are checked again when you place the order.</p>
        </Card>
      </aside>
    </form>
  );
}
