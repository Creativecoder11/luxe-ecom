import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/display";

interface KpiCardProps {
  label: string;
  /** Pre-formatted value from the reporting service. null means "no data": never substitute a sample number. */
  value: string | null;
  /** How the metric is defined (shown to users; reports must disclose definitions). */
  definition: string;
  icon?: LucideIcon;
}

export function KpiCard({ label, value, definition, icon: Icon }: KpiCardProps) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon className="size-[1.125rem]" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="font-display text-2xl font-bold tracking-tight">
        {value ?? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">No data</span>
          </>
        )}
      </p>
      <p className="text-xs text-subtle-foreground">{definition}</p>
    </Card>
  );
}
