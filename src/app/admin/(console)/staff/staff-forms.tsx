"use client";

import { Copy, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { echoed } from "@/lib/action-result";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  changeStaffRoleAction,
  createStaffAction,
  resetStaffPasswordAction,
  setStaffStatusAction,
} from "./actions";

export interface RoleOption {
  id: string;
  name: string;
  assignable: boolean;
}

function TemporaryPassword({ email, password }: { email?: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Alert tone="warning" title="Temporary password: shown only once">
      <p className="mb-2">
        Give this to {email ?? "the staff member"} through a secure channel. They must choose a new password at first
        sign-in. No email was sent (no email provider is configured).
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded bg-surface px-2 py-1 font-mono text-sm text-foreground">{password}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          <Copy /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Alert>
  );
}

export function AddStaffForm({ roles }: { roles: RoleOption[] }) {
  const [state, formAction] = useActionState(createStaffAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const created = state?.ok ? state.data : undefined;
  return (
    <div className="space-y-4">
      {created ? <TemporaryPassword email={created.email} password={created.temporaryPassword} /> : null}
      <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate key={created?.temporaryPassword}>
        <div className="sm:col-span-2">
          <FormAlert state={state && !state.ok ? state : null} />
        </div>
        <Field id="staff-name" label="Full name" error={errors.name} required>
          {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name")} autoComplete="off" required />}
        </Field>
        <Field id="staff-email" label="Work email" error={errors.email} required>
          {(aria) => <Input {...aria} name="email" type="email" defaultValue={echoed(state, "email")} autoComplete="off" required />}
        </Field>
        <Field id="staff-phone" label="Mobile number" hint="Optional" error={errors.phone}>
          {(aria) => <Input {...aria} name="phone" inputMode="tel" defaultValue={echoed(state, "phone")} autoComplete="off" />}
        </Field>
        <Field id="staff-title" label="Job title" hint="Optional" error={errors.jobTitle}>
          {(aria) => <Input {...aria} name="jobTitle" defaultValue={echoed(state, "jobTitle")} autoComplete="off" />}
        </Field>
        <Field id="staff-role" label="Role" error={errors.roleId} required className="sm:col-span-2">
          {(aria) => (
            <Select {...aria} name="roleId" defaultValue={echoed(state, "roleId") ?? ""} required>
              <option value="" disabled>
                Choose a role
              </option>
              {roles
                .filter((r) => r.assignable)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton pendingLabel="Creating…">
            <UserPlus /> Create staff account
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function StaffRoleForm({ staffId, staffName, roleId, roles }: { staffId: string; staffName: string; roleId: string; roles: RoleOption[] }) {
  const [state, formAction] = useActionState(changeStaffRoleAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="staffId" value={staffId} />
      <label htmlFor={`role-${staffId}`} className="sr-only">
        Role for {staffName}
      </label>
      <Select id={`role-${staffId}`} name="roleId" defaultValue={roleId} className="h-8 w-44 text-xs">
        {roles.map((r) => (
          <option key={r.id} value={r.id} disabled={!r.assignable}>
            {r.name}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="outline">
        Save
      </SubmitButton>
      {state && !state.ok ? <p className="w-full text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function StaffStatusForm({ staffId, status }: { staffId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const [state, formAction] = useActionState(setStaffStatusAction, null);
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (next === "SUSPENDED" && !window.confirm("Suspend this account? They will be signed out immediately.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton size="sm" variant={next === "SUSPENDED" ? "ghost" : "outline"} className={next === "SUSPENDED" ? "text-danger" : ""}>
        {next === "SUSPENDED" ? "Suspend" : "Reactivate"}
      </SubmitButton>
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function ResetPasswordForm({ staffId }: { staffId: string }) {
  const [state, formAction] = useActionState(resetStaffPasswordAction, null);
  return (
    <div className="space-y-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Issue a new temporary password? The current password stops working and they are signed out.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="staffId" value={staffId} />
        <SubmitButton size="sm" variant="ghost">
          Reset password
        </SubmitButton>
      </form>
      {state?.ok && state.data ? <TemporaryPassword password={state.data.temporaryPassword} /> : null}
      {state && !state.ok ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
  );
}
