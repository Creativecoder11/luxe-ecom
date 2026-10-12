import { MailWarning } from "lucide-react";
import { Suspense } from "react";
import { AdminChrome, type QuickAction } from "@/components/admin/admin-chrome";
import { Skeleton } from "@/components/ui/display";
import { adminModules } from "@/config/modules";
import { env } from "@/lib/env";
import { can, type StaffActor } from "@/modules/identity/actor";
import { isPermission, type Permission } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";

const QUICK_ACTIONS: (QuickAction & { permission: Permission })[] = [
  { label: "Product", href: "/admin/catalog/products/new", permission: "catalog.create" },
  { label: "Purchase order", href: "/admin/purchasing/new", permission: "purchasing.manage" },
  { label: "Coupon", href: "/admin/marketing/coupons", permission: "campaigns.manage" },
  { label: "Staff member", href: "/admin/staff", permission: "staff.manage" },
];

function EmailNotice() {
  // Truthful system state: no email provider exists yet (EMAIL_PROVIDER=none), so nothing is emailed.
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[#b7ebcd] bg-[#ecfdf3] px-4 py-2.5 text-sm text-[#05603a]">
      <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Email sending is not configured, so order confirmations and password-reset emails are not delivered.{" "}
        <strong className="font-semibold">An email provider is connected in Gate 6.</strong>
      </span>
    </p>
  );
}

async function AuthenticatedConsole({ children }: { children: React.ReactNode }) {
  const actor: StaffActor = await requireStaff();
  const visibleModules = adminModules.filter((m) => isPermission(m.permission) && can(actor, m.permission)).map((m) => m.key);
  const quickActions = QUICK_ACTIONS.filter((a) => can(actor, a.permission)).map(({ label, href }) => ({ label, href }));
  const notice = env().EMAIL_PROVIDER === "none" && can(actor, "settings.view") ? <EmailNotice /> : null;
  return (
    <AdminChrome visibleModules={visibleModules} user={{ name: actor.name, email: actor.email, roleName: actor.roleName }} quickActions={quickActions} notice={notice}>
      {children}
    </AdminChrome>
  );
}

function ConsoleSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-[16.5rem] border-r border-border bg-surface lg:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

// Each page re-checks the session and its own permission (layouts do not re-render on client navigation).
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <AuthenticatedConsole>{children}</AuthenticatedConsole>
    </Suspense>
  );
}
