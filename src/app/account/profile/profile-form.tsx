"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { echoed } from "@/lib/action-result";
import { Field, Input } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfileAction } from "../actions";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, formAction] = useActionState(updateProfileAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <Field id="name" label="Full name" error={errors.name} required>
        {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name") ?? name} autoComplete="name" required />}
      </Field>
      <Field id="phone" label="Mobile number" error={errors.phone} required>
        {(aria) => <Input {...aria} name="phone" defaultValue={echoed(state, "phone") ?? phone} type="tel" inputMode="tel" autoComplete="tel" required />}
      </Field>
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
