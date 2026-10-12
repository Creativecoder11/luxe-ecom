"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { saveCommerceSettingsAction, saveTaxClassAction } from "./actions";

export interface SettingsValue {
  pricesIncludeTax: boolean;
  vatRegistrationNumber: string;
  codEnabled: boolean;
  codMaxOrder: string;
  guestCheckoutEnabled: boolean;
  lowStockThreshold: string;
}

export function CommerceSettingsForm({ value, canEdit }: { value: SettingsValue; canEdit: boolean }) {
  const [state, formAction] = useActionState(saveCommerceSettingsAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pricesIncludeTax" label="Catalog prices" hint="How the prices you enter on products relate to VAT.">
            {(aria) => (
              <Select {...aria} name="pricesIncludeTax" defaultValue={value.pricesIncludeTax ? "inclusive" : "exclusive"}>
                <option value="inclusive">Include VAT (VAT shown as included)</option>
                <option value="exclusive">Exclude VAT (VAT added at checkout)</option>
              </Select>
            )}
          </Field>
          <Field id="vatRegistrationNumber" label="VAT registration number (BIN)" hint="Printed on invoices. Optional." error={errors.vatRegistrationNumber}>
            {(aria) => <Input {...aria} name="vatRegistrationNumber" defaultValue={echoed(state, "vatRegistrationNumber") ?? value.vatRegistrationNumber} />}
          </Field>
        </div>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox name="codEnabled" defaultChecked={value.codEnabled} className="mt-0.5" />
            <span>
              <span className="font-medium">Cash on Delivery</span>
              <span className="block text-muted-foreground">Available across Bangladesh. Turn off or add a fee for specific delivery zones.</span>
            </span>
          </label>
          <Field id="codMaxOrder" label="Maximum COD order (৳)" hint="Optional limit per order." error={errors.codMaxOrder} className="sm:w-72">
            {(aria) => <Input {...aria} name="codMaxOrder" inputMode="decimal" defaultValue={echoed(state, "codMaxOrder") ?? value.codMaxOrder} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox name="guestCheckoutEnabled" defaultChecked={value.guestCheckoutEnabled} className="mt-0.5" />
            <span>
              <span className="font-medium">Guest checkout</span>
              <span className="block text-muted-foreground">Customers can order without an account (mobile number required).</span>
            </span>
          </label>
          <Field id="lowStockThreshold" label="Default low-stock level" hint="Variants at or below this many available units are flagged." error={errors.lowStockThreshold}>
            {(aria) => <Input {...aria} name="lowStockThreshold" inputMode="numeric" defaultValue={echoed(state, "lowStockThreshold") ?? value.lowStockThreshold} />}
          </Field>
        </div>
        {canEdit ? <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton> : null}
      </fieldset>
    </form>
  );
}

export function TaxClassForm({ value }: { value: { id?: string; name: string; code: string; ratePercent: string; isDefault: boolean } }) {
  const [state, formAction] = useActionState(saveTaxClassAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_6rem_auto_auto]" noValidate key={value.id ?? "new"}>
      {value.id ? <input type="hidden" name="taxClassId" value={value.id} /> : null}
      <Field id={`tc-name-${value.id ?? "new"}`} label="Name" error={errors.name}>
        {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name") ?? value.name} className="h-9" />}
      </Field>
      <Field id={`tc-code-${value.id ?? "new"}`} label="Code" error={errors.code}>
        {(aria) => <Input {...aria} name="code" defaultValue={echoed(state, "code") ?? value.code} className="h-9" />}
      </Field>
      <Field id={`tc-rate-${value.id ?? "new"}`} label="Rate %" error={errors.ratePercent}>
        {(aria) => <Input {...aria} name="ratePercent" inputMode="decimal" defaultValue={echoed(state, "ratePercent") ?? value.ratePercent} className="h-9" />}
      </Field>
      <label className="flex h-9 items-center gap-2 text-sm">
        <Checkbox name="isDefault" defaultChecked={value.isDefault} /> Default
      </label>
      <SubmitButton size="sm" variant="outline">{value.id ? "Save" : "Add"}</SubmitButton>
      <div className="sm:col-span-5">
        <FormAlert state={state} />
      </div>
    </form>
  );
}
