"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Field, Input } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/action-result";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** Change-password form shared by staff (forced change) and customers. */
export function ChangePasswordForm({ action, submitLabel = "Update password" }: { action: Action; submitLabel?: string }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <Field id="currentPassword" label="Current password" error={errors.currentPassword} required>
        {(aria) => <Input {...aria} name="currentPassword" type="password" autoComplete="current-password" required />}
      </Field>
      <Field id="newPassword" label="New password" hint="At least 10 characters." error={errors.newPassword} required>
        {(aria) => <Input {...aria} name="newPassword" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword} required>
        {(aria) => <Input {...aria} name="confirmPassword" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Updating…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
