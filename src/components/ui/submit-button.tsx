"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./display";

/** Submit button that disables itself and shows progress while its form's action runs. */
export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner label={pendingLabel ?? "Working"} />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
