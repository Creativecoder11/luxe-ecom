import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
