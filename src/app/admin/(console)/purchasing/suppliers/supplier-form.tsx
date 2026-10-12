"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { saveSupplierAction } from "../actions";

export interface SupplierValue {
  id?: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
}

export function SupplierForm({ value }: { value: SupplierValue }) {
  const [state, formAction] = useActionState(saveSupplierAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const v = (k: keyof Omit<SupplierValue, "id" | "isActive">) => echoed(state, k) ?? value[k];
  return (
    <form action={formAction} className="space-y-4" noValidate key={value.id ?? "new"}>
      <FormAlert state={state} />
      {value.id ? <input type="hidden" name="supplierId" value={value.id} /> : null}
      <Field id="sup-name" label="Supplier name" error={errors.name} required>{(aria) => <Input {...aria} name="name" defaultValue={v("name")} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sup-contact" label="Contact person" error={errors.contactName}>{(aria) => <Input {...aria} name="contactName" defaultValue={v("contactName")} />}</Field>
        <Field id="sup-phone" label="Phone" error={errors.phone}>{(aria) => <Input {...aria} name="phone" inputMode="tel" defaultValue={v("phone")} />}</Field>
      </div>
      <Field id="sup-email" label="Email" error={errors.email}>{(aria) => <Input {...aria} name="email" type="email" defaultValue={v("email")} />}</Field>
      <Field id="sup-address" label="Address" error={errors.address}>{(aria) => <Textarea {...aria} name="address" rows={2} defaultValue={v("address")} />}</Field>
      <Field id="sup-notes" label="Notes" error={errors.notes}>{(aria) => <Textarea {...aria} name="notes" rows={2} defaultValue={v("notes")} />}</Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="isActive" defaultChecked={value.isActive} /> Active</label>
      <SubmitButton pendingLabel="Saving…">{value.id ? "Save supplier" : "Add supplier"}</SubmitButton>
    </form>
  );
}
