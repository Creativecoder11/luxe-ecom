"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { saveCouponAction } from "./actions";

export interface CouponValue {
  id?: string;
  code: string;
  description: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  percent: string;
  amount: string;
  maxDiscount: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
}

export function CouponForm({ value }: { value: CouponValue }) {
  const [state, formAction] = useActionState(saveCouponAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const v = (k: keyof Omit<CouponValue, "id" | "isActive" | "type">) => echoed(state, k) ?? value[k];
  const [type, setType] = useState(value.type);
  return (
    <form action={formAction} className="space-y-4" noValidate key={value.id ?? "new"}>
      <FormAlert state={state} />
      {value.id ? <input type="hidden" name="couponId" value={value.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cp-code" label="Code" hint="Customers type this at checkout." error={errors.code} required>{(aria) => <Input {...aria} name="code" className="uppercase" defaultValue={v("code")} />}</Field>
        <Field id="cp-type" label="Discount" error={errors.type}>
          {(aria) => (
            <Select {...aria} name="type" value={type} onChange={(e) => setType(e.target.value as CouponValue["type"])}>
              <option value="PERCENT">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
              <option value="FREE_SHIPPING">Free delivery</option>
            </Select>
          )}
        </Field>
        {type === "PERCENT" ? (
          <>
            <Field id="cp-percent" label="Percent off" error={errors.percent} required>{(aria) => <Input {...aria} name="percent" inputMode="decimal" defaultValue={v("percent")} />}</Field>
            <Field id="cp-max" label="Maximum discount (৳)" hint="Optional cap." error={errors.maxDiscount}>{(aria) => <Input {...aria} name="maxDiscount" inputMode="decimal" defaultValue={v("maxDiscount")} />}</Field>
          </>
        ) : null}
        {type === "FIXED" ? (
          <Field id="cp-amount" label="Amount off (৳)" error={errors.amount} required>{(aria) => <Input {...aria} name="amount" inputMode="decimal" defaultValue={v("amount")} />}</Field>
        ) : null}
        <Field id="cp-min" label="Minimum order (৳)" hint="Optional, before delivery." error={errors.minSubtotal}>{(aria) => <Input {...aria} name="minSubtotal" inputMode="decimal" defaultValue={v("minSubtotal")} />}</Field>
        <Field id="cp-starts" label="Starts" error={errors.startsAt}>{(aria) => <Input {...aria} name="startsAt" type="datetime-local" defaultValue={v("startsAt")} />}</Field>
        <Field id="cp-ends" label="Ends" error={errors.endsAt}>{(aria) => <Input {...aria} name="endsAt" type="datetime-local" defaultValue={v("endsAt")} />}</Field>
        <Field id="cp-limit" label="Total uses" hint="Optional." error={errors.usageLimit}>{(aria) => <Input {...aria} name="usageLimit" inputMode="numeric" defaultValue={v("usageLimit")} />}</Field>
        <Field id="cp-per" label="Uses per customer" hint="Optional (counted by mobile number)." error={errors.perCustomerLimit}>{(aria) => <Input {...aria} name="perCustomerLimit" inputMode="numeric" defaultValue={v("perCustomerLimit")} />}</Field>
        <Field id="cp-desc" label="Internal description" className="sm:col-span-2" error={errors.description}>{(aria) => <Input {...aria} name="description" defaultValue={v("description")} />}</Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={value.isActive} /> Active</label>
      <SubmitButton pendingLabel="Saving…">{value.id ? "Save coupon" : "Create coupon"}</SubmitButton>
    </form>
  );
}
