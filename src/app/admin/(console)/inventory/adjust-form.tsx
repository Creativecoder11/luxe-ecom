"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { adjustStockAction } from "./actions";

export function AdjustStockForm({ variantId, reasons }: { variantId: string; reasons: [string, string][] }) {
  const [state, formAction] = useActionState(adjustStockAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="variantId" value={variantId} />
      <Field id="adj-qty" label="Change in units" hint="Positive to add, negative to remove, e.g. 24 or -3." error={errors.quantity} required>
        {(aria) => <Input {...aria} name="quantity" inputMode="numeric" defaultValue={echoed(state, "quantity") ?? ""} />}
      </Field>
      <Field id="adj-reason" label="Reason" error={errors.reason} required>
        {(aria) => (
          <Select {...aria} name="reason" defaultValue={echoed(state, "reason") ?? "COUNT_CORRECTION"}>
            {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        )}
      </Field>
      <Field id="adj-note" label="Note" hint="Recorded in the stock ledger." error={errors.note}>
        {(aria) => <Textarea {...aria} name="note" rows={2} defaultValue={echoed(state, "note") ?? ""} />}
      </Field>
      <SubmitButton pendingLabel="Saving…">Record adjustment</SubmitButton>
    </form>
  );
}
