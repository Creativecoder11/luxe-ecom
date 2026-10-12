import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/display";
import { STATUS_LABEL, type BuildStatus } from "@/config/modules";
import { cn } from "@/lib/utils/cn";

interface ModuleStatusNoticeProps {
  status: BuildStatus;
  gate: number;
  release?: number;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Plainly marks UI that is a prototype or not built yet, so a layout preview is never
 * mistaken for working software.
 */
export function ModuleStatusNotice({ status, gate, release = 1, children, className }: ModuleStatusNoticeProps) {
  if (status === "implemented" || status === "tested") return null;
  return (
    <div
      role="note"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Construction className="size-4 shrink-0 text-warning" aria-hidden="true" />
        <Badge tone="warning">{STATUS_LABEL[status]}</Badge>
      </div>
      <p className="text-foreground/80">
        {children ??
          (status === "planned"
            ? `This module is planned for Release ${release} (Gate ${gate}). Nothing here is functional yet.`
            : `Data and actions arrive in Gate ${gate}; nothing shown here is real.`)}
      </p>
    </div>
  );
}
