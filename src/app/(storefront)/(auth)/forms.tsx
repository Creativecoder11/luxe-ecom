"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { echoed } from "@/lib/action-result";
import { Field, Input } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerCustomerAction, requestPasswordResetAction, resetPasswordAction, signInCustomerAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInCustomerAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email" error={errors.email} required>
        {(aria) => <Input {...aria} name="email" type="email" defaultValue={echoed(state, "email")} autoComplete="email" required />}
      </Field>
      <Field id="password" label="Password" error={errors.password} required>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(registerCustomerAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Field id="name" label="Full name" error={errors.name} required>
        {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name")} autoComplete="name" required />}
      </Field>
      <Field id="phone" label="Mobile number" hint="Used for delivery updates, e.g. 01712345678." error={errors.phone} required>
        {(aria) => <Input {...aria} name="phone" type="tel" inputMode="tel" defaultValue={echoed(state, "phone")} autoComplete="tel" required />}
      </Field>
      <Field id="email" label="Email" error={errors.email} required>
        {(aria) => <Input {...aria} name="email" type="email" defaultValue={echoed(state, "email")} autoComplete="email" required />}
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters." error={errors.password} required>
        {(aria) => <Input {...aria} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword} required>
        {(aria) => <Input {...aria} name="confirmPassword" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <Field id="email" label="Email" error={errors.email} required>
        {(aria) => <Input {...aria} name="email" type="email" defaultValue={echoed(state, "email")} autoComplete="email" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Requesting…">
        Request reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <Field id="newPassword" label="New password" hint="At least 10 characters." error={errors.newPassword} required>
        {(aria) => <Input {...aria} name="newPassword" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword} required>
        {(aria) => <Input {...aria} name="confirmPassword" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
