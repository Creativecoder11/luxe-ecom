import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/display";

export function AccessDenied({ permission }: { permission?: string }) {
  return (
    <EmptyState
      icon={<Lock />}
      title="You don't have access to this page"
      description={
        <>
          Ask a business owner or admin to update your role.
          {permission ? <span className="mt-1 block text-xs">Required permission: {permission}</span> : null}
        </>
      }
    />
  );
}
