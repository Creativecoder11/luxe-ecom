"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed } from "@/lib/action-result";
import { deleteBrandAction, saveBrandAction } from "../actions";

export interface BrandValue {
  id?: string;
  name: string;
  slug: string;
  description: string;
  status: "ACTIVE" | "HIDDEN";
}

export function BrandForm({ value }: { value: BrandValue }) {
  const [state, formAction] = useActionState(saveBrandAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate key={value.id ?? "new"}>
      <FormAlert state={state} />
      {value.id ? <input type="hidden" name="brandId" value={value.id} /> : null}
      <Field id="brand-name" label="Name" error={errors.name} required>
        {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name") ?? value.name} />}
      </Field>
      <Field id="brand-slug" label="URL slug" hint="Leave empty to generate." error={errors.slug}>
        {(aria) => <Input {...aria} name="slug" defaultValue={echoed(state, "slug") ?? value.slug} />}
      </Field>
      <Field id="brand-status" label="Visibility">
        {(aria) => (
          <Select {...aria} name="status" defaultValue={echoed(state, "status") ?? value.status}>
            <option value="ACTIVE">Visible</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
        )}
      </Field>
      <Field id="brand-description" label="Description">
        {(aria) => <Textarea {...aria} name="description" rows={3} defaultValue={echoed(state, "description") ?? value.description} />}
      </Field>
      <SubmitButton pendingLabel="Saving…">{value.id ? "Save brand" : "Create brand"}</SubmitButton>
    </form>
  );
}

export function DeleteBrandButton({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(deleteBrandAction, null);
  return (
    <form action={formAction} onSubmit={(e) => { if (!window.confirm("Delete this brand?")) e.preventDefault(); }} className="space-y-2">
      <FormAlert state={state} />
      <input type="hidden" name="brandId" value={brandId} />
      <SubmitButton size="sm" variant="ghost" className="text-danger">Delete brand</SubmitButton>
    </form>
  );
}
