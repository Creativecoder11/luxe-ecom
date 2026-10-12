import { Skeleton } from "@/components/ui/display";

export function AdminPageSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
