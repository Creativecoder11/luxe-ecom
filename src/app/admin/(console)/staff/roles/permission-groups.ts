import { PERMISSION_GROUPS } from "@/modules/identity/permissions";
import type { PermissionGroupView } from "./role-form";

export function permissionGroupsView(): PermissionGroupView[] {
  return Object.entries(PERMISSION_GROUPS).map(([group, perms]) => ({
    group,
    permissions: Object.entries(perms).map(([key, description]) => ({ key, description })),
  }));
}
