import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

const controlBase =
  "w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/30";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlBase, "h-10 appearance-auto pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 rounded border-border-strong accent-primary", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

interface FieldProps {
  /** id of the control inside; used to wire label, hint and error for screen readers. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (aria: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/** Label + control + hint/error, with aria wiring handled in one place. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden="true">*</span> : null}
      </Label>
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p id={errorId} className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
