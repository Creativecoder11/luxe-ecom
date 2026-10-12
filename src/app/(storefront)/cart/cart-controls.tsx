"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Input, Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { applyCouponAction, removeCouponAction, updateCartLineAction } from "./actions";

export function QuantityControl({ variantId, quantity, max, label }: { variantId: string; quantity: number; max: number; label: string }) {
  const [state, formAction] = useActionState(updateCartLineAction, null);
  const options = Array.from({ length: Math.max(quantity, Math.min(max, 99)) }, (_, i) => i + 1);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="variantId" value={variantId} />
          <label className="sr-only" htmlFor={`qty-${variantId}`}>Quantity of {label}</label>
          <Select
            id={`qty-${variantId}`}
            name="quantity"
            defaultValue={String(quantity)}
            className="h-9 w-20"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {options.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <noscript><Button type="submit" size="sm" variant="outline">Update</Button></noscript>
        </form>
        <form action={formAction}>
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="quantity" value="0" />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label={`Remove ${label}`}>
            <Trash2 />
          </Button>
        </form>
      </div>
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}

export function CouponForm({ applied, error }: { applied: string | null; error: string | null }) {
  const [state, formAction] = useActionState(applyCouponAction, null);
  if (applied) {
    return (
      <div className="space-y-2">
        <form action={removeCouponAction} className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
          <span>
            Coupon <span className="font-mono font-semibold">{applied}</span>
          </span>
          <Button type="submit" size="sm" variant="link">Remove</Button>
        </form>
        {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">Coupon code</label>
        <Input id="coupon" name="code" placeholder="Coupon code" autoComplete="off" className="h-10 uppercase" />
        <SubmitButton variant="outline">Apply</SubmitButton>
      </div>
      <FormAlert state={state} />
    </form>
  );
}
