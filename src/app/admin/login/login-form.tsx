"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { echoed } from "@/lib/action-result";
import { Field, Input } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { signInStaffAction } from "../actions";

export function StaffLoginForm() {
  const [state, formAction] = useActionState(signInStaffAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <Field id="email" label="Work email" error={errors.email} required>
        {(aria) => <Input {...aria} name="email" type="email" defaultValue={echoed(state, "email")} autoComplete="username" required autoFocus />}
      </Field>
      <Field id="password" label="Password" error={errors.password} required>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
