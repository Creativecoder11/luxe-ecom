"use client";

import { useActionState, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed, echoedAll } from "@/lib/action-result";
import { deleteShippingZoneAction, saveShippingZoneAction } from "../actions";

export interface ZoneValue {
  id?: string;
  name: string;
  isFallback: boolean;
  districts: string[];
  baseFee: string;
  includedWeightGrams: string;
  extraPerKg: string;
  freeShippingThreshold: string;
  codEnabled: boolean;
  codFee: string;
  estimate: string;
  isActive: boolean;
  sortOrder: string;
}

interface Props {
  value: ZoneValue;
  divisions: { division: string; districts: { code: string; name: string; takenBy: string | null }[] }[];
}

export function ZoneForm({ value, divisions }: Props) {
  const [state, formAction] = useActionState(saveShippingZoneAction, null);
  const [deleteState, deleteAction] = useActionState(deleteShippingZoneAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [fallback, setFallback] = useState(value.isFallback);
  const selected = new Set(echoedAll(state, "districts") ?? value.districts);
  const v = (key: keyof ZoneValue) => echoed(state, key) ?? String(value[key]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{value.id ? `Edit “${value.name}”` : "New delivery zone"}</CardTitle>
      </CardHeader>
      <form action={formAction} className="space-y-4 px-5 pb-5" noValidate>
        {value.id ? <input type="hidden" name="zoneId" value={value.id} /> : null}
        <FormAlert state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="zone-name" label="Zone name" hint="Shown at checkout, e.g. Inside Dhaka." error={errors.name} required>
            {(aria) => <Input {...aria} name="name" defaultValue={v("name")} />}
          </Field>
          <Field id="zone-estimate" label="Delivery estimate" hint="e.g. 1–2 days" error={errors.estimate}>
            {(aria) => <Input {...aria} name="estimate" defaultValue={v("estimate")} />}
          </Field>
          <Field id="zone-base" label="Delivery fee (৳)" hint="For parcels up to the included weight." error={errors.baseFee} required>
            {(aria) => <Input {...aria} name="baseFee" inputMode="decimal" defaultValue={v("baseFee")} />}
          </Field>
          <Field id="zone-weight" label="Included weight (grams)" error={errors.includedWeightGrams}>
            {(aria) => <Input {...aria} name="includedWeightGrams" inputMode="numeric" defaultValue={v("includedWeightGrams")} />}
          </Field>
          <Field id="zone-extra" label="Extra per additional kg (৳)" hint="Each started kg above the included weight." error={errors.extraPerKg}>
            {(aria) => <Input {...aria} name="extraPerKg" inputMode="decimal" defaultValue={v("extraPerKg")} />}
          </Field>
          <Field id="zone-free" label="Free delivery from (৳)" hint="Optional order value (after discounts)." error={errors.freeShippingThreshold}>
            {(aria) => <Input {...aria} name="freeShippingThreshold" inputMode="decimal" defaultValue={v("freeShippingThreshold")} />}
          </Field>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox name="codEnabled" defaultChecked={value.codEnabled} className="mt-0.5" />
            <span><span className="font-medium">Cash on Delivery</span><span className="block text-muted-foreground">Allow COD in this zone.</span></span>
          </label>
          <Field id="zone-codfee" label="COD charge (৳)" hint="Optional fee added for COD orders." error={errors.codFee}>
            {(aria) => <Input {...aria} name="codFee" inputMode="decimal" defaultValue={v("codFee")} />}
          </Field>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="isActive" defaultChecked={value.isActive} /> Active
          </label>
          <Field id="zone-sort" label="Sort order" error={errors.sortOrder}>
            {(aria) => <Input {...aria} name="sortOrder" inputMode="numeric" defaultValue={v("sortOrder")} />}
          </Field>
        </div>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Districts</legend>
          <label className="mb-3 flex items-start gap-2.5 text-sm">
            <Checkbox name="isFallback" checked={fallback} onChange={(e) => setFallback(e.target.checked)} className="mt-0.5" />
            <span><span className="font-medium">Rest of Bangladesh</span><span className="block text-muted-foreground">Covers every district not in another active zone.</span></span>
          </label>
          {errors.districts ? <p className="mb-2 text-xs text-danger">{errors.districts}</p> : null}
          {!fallback ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {divisions.map((d) => (
                <div key={d.division}>
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.division}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {d.districts.map((dist) => (
                      <label key={dist.code} className="flex items-center gap-2 text-sm" title={dist.takenBy ? `In zone: ${dist.takenBy}` : undefined}>
                        <Checkbox name="districts" value={dist.code} defaultChecked={selected.has(dist.code)} disabled={!!dist.takenBy} />
                        <span className={dist.takenBy ? "text-subtle-foreground" : undefined}>{dist.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </fieldset>
        <SubmitButton pendingLabel="Saving…">{value.id ? "Save zone" : "Create zone"}</SubmitButton>
      </form>
      {value.id ? (
        <form action={deleteAction} className="border-t border-border px-5 py-4" onSubmit={(e) => { if (!window.confirm("Delete this zone? Orders already placed keep their fees.")) e.preventDefault(); }}>
          <input type="hidden" name="zoneId" value={value.id} />
          <FormAlert state={deleteState} />
          <SubmitButton size="sm" variant="ghost" className="text-danger">Delete zone</SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
