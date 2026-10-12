"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { Select } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { bulkProductsAction } from "../actions";

/** Wraps the product table so row checkboxes (name="productIds") submit with the chosen bulk action. */
export function BulkProductsForm({ children, actions }: { children: React.ReactNode; actions: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState(bulkProductsAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      {actions.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="bulkAction" className="text-sm text-muted-foreground">With selected</label>
          <Select id="bulkAction" name="bulkAction" defaultValue="" className="h-9 w-48">
            <option value="" disabled>Choose an action</option>
            {actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <SubmitButton size="sm" variant="outline">Apply</SubmitButton>
        </div>
      ) : null}
      {children}
    </form>
  );
}
