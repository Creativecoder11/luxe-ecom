"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { productLifecycleAction } from "../actions";

export interface LifecycleButton {
  action: "publish" | "unpublish" | "archive" | "restore" | "duplicate" | "delete";
  label: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  confirm?: string;
}

export function ProductLifecycleActions({ productId, buttons }: { productId: string; buttons: LifecycleButton[] }) {
  const [state, formAction] = useActionState(productLifecycleAction, null);
  if (buttons.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <form
            key={b.action}
            action={formAction}
            onSubmit={(event) => {
              if (b.confirm && !window.confirm(b.confirm)) event.preventDefault();
            }}
          >
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="action" value={b.action} />
            <SubmitButton variant={b.variant ?? "outline"} size="sm">
              {b.label}
            </SubmitButton>
          </form>
        ))}
      </div>
      <FormAlert state={state} />
    </div>
  );
}
