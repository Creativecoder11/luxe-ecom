"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { echoed, echoedAll, type ActionResult } from "@/lib/action-result";
import { deleteRoleAction } from "../actions";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

export interface PermissionGroupView {
  group: string;
  permissions: { key: string; description: string }[];
}

interface RoleFormProps {
  action: Action;
  groups: PermissionGroupView[];
  role?: { id: string; name: string; description: string | null; permissions: string[]; isSystem: boolean; staffCount: number };
  /** Permissions the editor may grant (owner: all). Others are shown but cannot be newly granted. */
  grantable: string[];
  readOnly?: boolean;
}

export function RoleForm({ action, groups, role, grantable, readOnly }: RoleFormProps) {
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const granted = new Set(echoedAll(state, "permissions") ?? role?.permissions ?? []);
  const canGrant = new Set(grantable);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6" noValidate>
        <FormAlert state={state} />
        {role ? <input type="hidden" name="roleId" value={role.id} /> : null}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field id="role-name" label="Role name" error={errors.name} required>
            {(aria) => <Input {...aria} name="name" defaultValue={echoed(state, "name") ?? role?.name} disabled={readOnly} required />}
          </Field>
          <Field id="role-description" label="Description" error={errors.description}>
            {(aria) => <Textarea {...aria} name="description" defaultValue={echoed(state, "description") ?? role?.description ?? ""} disabled={readOnly} className="min-h-10" />}
          </Field>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.group} className="p-5">
              <fieldset disabled={readOnly}>
                <legend className="mb-3 text-sm font-semibold">{group.group}</legend>
                <ul className="space-y-2.5">
                  {group.permissions.map((p) => {
                    const has = granted.has(p.key);
                    const locked = !has && !canGrant.has(p.key);
                    return (
                      <li key={p.key}>
                        <label className="flex items-start gap-2.5 text-sm">
                          <Checkbox name="permissions" value={p.key} defaultChecked={has} disabled={locked} className="mt-0.5" />
                          <span>
                            <span className="block">{p.description}</span>
                            <span className="block font-mono text-xs text-subtle-foreground">
                              {p.key}
                              {locked ? " · you cannot grant this" : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </Card>
          ))}
        </div>

        {readOnly ? null : (
          <SubmitButton pendingLabel="Saving…">{role ? "Save role" : "Create role"}</SubmitButton>
        )}
      </form>

      {role && !role.isSystem && !readOnly ? <DeleteRole roleId={role.id} staffCount={role.staffCount} /> : null}
    </div>
  );
}

function DeleteRole({ roleId, staffCount }: { roleId: string; staffCount: number }) {
  const [state, formAction] = useActionState(deleteRoleAction, null);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Delete this role?")) event.preventDefault();
      }}
      className="space-y-2 border-t border-border pt-6"
    >
      <FormAlert state={state} />
      <input type="hidden" name="roleId" value={roleId} />
      <Button type="submit" variant="ghost" className="text-danger" disabled={staffCount > 0}>
        Delete role
      </Button>
      {staffCount > 0 ? <p className="text-xs text-muted-foreground">Reassign its {staffCount} staff member(s) before deleting.</p> : null}
    </form>
  );
}
