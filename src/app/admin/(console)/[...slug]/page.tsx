import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { AdminPageSkeleton } from "@/components/admin/page-skeleton";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ModuleStatusNotice } from "@/components/common/module-status-notice";
import { Badge, Card } from "@/components/ui/display";
import { adminModules, findAdminModuleByPath, isNavigable, type AdminModule } from "@/config/modules";
import { can } from "@/modules/identity/actor";
import { isPermission } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";

// Placeholder pages for Release 1 modules that are not built yet. Each real module replaces
// its entry here with a dedicated route as it is implemented.
export function generateStaticParams() {
  return adminModules
    .filter((m) => m.path !== "" && isNavigable(m) && m.status === "planned")
    .map((m) => ({ slug: m.path.split("/") }));
}

// notFound() runs before anything streams, so unknown or Release 2/3 paths get a real HTTP 404.
export default async function AdminModulePage({ params }: PageProps<"/admin/[...slug]">) {
  const { slug } = await params;
  const mod = findAdminModuleByPath(slug.join("/"));
  if (!mod || !isNavigable(mod) || mod.status !== "planned") notFound();

  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ModulePlaceholder mod={mod} />
    </Suspense>
  );
}

async function ModulePlaceholder({ mod }: { mod: AdminModule }) {
  const actor = await requireStaff();
  if (!isPermission(mod.permission) || !can(actor, mod.permission)) return <AccessDenied permission={mod.permission} />;
  return (
    <>
      <AdminPageHeader title={mod.label} description={mod.summary} />
      <ModuleStatusNotice status={mod.status} gate={mod.gate} release={mod.release} className="mb-6" />
      <Card className="p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Release</dt>
            <dd className="mt-1 font-medium">Release {mod.release}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivered in</dt>
            <dd className="mt-1 font-medium">Gate {mod.gate}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">External provider</dt>
            <dd className="mt-1">
              {mod.requiresProvider ? (
                <Badge tone="warning">Required · unconfigured</Badge>
              ) : (
                <Badge>Not required</Badge>
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </>
  );
}

