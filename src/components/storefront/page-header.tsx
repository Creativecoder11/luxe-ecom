import type { ReactNode } from "react";

export function StorefrontPageHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
