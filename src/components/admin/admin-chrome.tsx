"use client";

import {
  BarChart3,
  ChevronDown,
  Globe,
  KeyRound,
  Layers,
  LogOut,
  Megaphone,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/display";
import { ADMIN_GROUP_ORDER, adminHref, adminModules, isNavigable, type AdminGroup, type AdminModule } from "@/config/modules";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import { signOutStaffAction } from "@/app/admin/actions";
import { adminNavIcons } from "./nav-icons";
import { applySidebarState, setSidebarState, useSidebarState } from "./sidebar-state";

const GROUP_ICONS: Record<AdminGroup, LucideIcon> = {
  Overview: BarChart3,
  Sales: ShoppingBag,
  Catalog: Package,
  Inventory: Warehouse,
  Fulfilment: Truck,
  Customers: Users,
  Marketing: Megaphone,
  Finance: Wallet,
  Insights: BarChart3,
  System: Settings,
  "Later releases": Layers,
};

/** Active pill: green-to-blue gradient from the design. */
const ACTIVE_PILL = "bg-gradient-to-r from-[#2fcf7f] via-[#1aa6b7] to-[#1570ef] text-white shadow-[0_6px_16px_-6px_rgb(21_112_239/0.55)]";

function isActive(pathname: string, module: AdminModule): boolean {
  const href = adminHref(module);
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function ModuleIcon({ module, className }: { module: AdminModule; className?: string }) {
  const Icon = adminNavIcons[module.key];
  return Icon ? <Icon className={cn("size-[1.125rem] shrink-0", className)} aria-hidden="true" /> : null;
}

function NavLink({ module, pathname, nested = false }: { module: AdminModule; pathname: string; nested?: boolean }) {
  if (!isNavigable(module)) {
    return (
      <li>
        <span
          aria-disabled="true"
          title={`${module.label}: not available yet (Release ${module.release})`}
          className={cn("flex cursor-not-allowed items-center gap-3 rounded-full py-2 pr-3 text-sm text-subtle-foreground/80", nested ? "pl-11" : "pl-4")}
        >
          {nested ? null : <ModuleIcon module={module} />}
          <span className="sidebar-label flex-1 truncate">{module.label}</span>
          <span className="sidebar-label">
            <Badge tone="neutral" className="px-1.5 text-[0.625rem]">
              R{module.release}
            </Badge>
          </span>
          <span className="sr-only">, not available yet</span>
        </span>
      </li>
    );
  }
  const active = isActive(pathname, module);
  return (
    <li>
      <Link
        href={adminHref(module)}
        aria-current={active ? "page" : undefined}
        title={module.label}
        className={cn(
          "flex items-center gap-3 rounded-full py-2.5 pr-3 text-sm transition-colors",
          nested ? "pl-11" : "pl-4",
          active ? cn(ACTIVE_PILL, "font-semibold") : "text-[#344054] hover:bg-[#f2f4f7] hover:text-foreground",
        )}
      >
        {nested ? null : <ModuleIcon module={module} />}
        <span className="sidebar-label flex-1 truncate">{module.label}</span>
        {module.status === "planned" ? (
          <span className={cn("sidebar-label size-1.5 rounded-full", active ? "bg-white/70" : "bg-border-strong")} title="Not built yet" aria-hidden="true" />
        ) : null}
      </Link>
    </li>
  );
}

function NavGroup({ group, modules, pathname, onExpandSidebar }: { group: AdminGroup; modules: AdminModule[]; pathname: string; onExpandSidebar?: () => void }) {
  const containsActive = modules.some((m) => isActive(pathname, m));
  const [open, setOpen] = useState(containsActive);
  const [lastActive, setLastActive] = useState(containsActive);
  if (containsActive !== lastActive) {
    setLastActive(containsActive);
    if (containsActive) setOpen(true);
  }
  const Icon = GROUP_ICONS[group];
  const id = `nav-group-${group.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        title={group}
        onClick={() => {
          onExpandSidebar?.();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-full py-2.5 pr-3 pl-4 text-sm transition-colors",
          containsActive && !open ? cn(ACTIVE_PILL, "font-semibold") : "text-[#344054] hover:bg-[#f2f4f7] hover:text-foreground",
        )}
      >
        <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
        <span className="sidebar-label flex-1 truncate text-left">{group}</span>
        <ChevronDown className={cn("sidebar-label size-4 transition-transform", open ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      <ul id={id} hidden={!open} className="sidebar-label mt-0.5 space-y-0.5">
        {modules.map((m) => (
          <NavLink key={m.key} module={m} pathname={pathname} nested />
        ))}
      </ul>
    </li>
  );
}

function SidebarNav({ pathname, visible, onExpandSidebar }: { pathname: string; visible: ReadonlySet<string>; onExpandSidebar?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-4 py-3">
      <ul className="space-y-1">
        {ADMIN_GROUP_ORDER.map((group) => {
          const modules = adminModules.filter((m) => m.group === group && visible.has(m.key));
          if (modules.length === 0) return null;
          // Single-module groups (Overview, Insights…) are plain links, as in the design.
          if (modules.length === 1) return <NavLink key={group} module={modules[0]!} pathname={pathname} />;
          return <NavGroup key={group} group={group} modules={modules} pathname={pathname} onExpandSidebar={onExpandSidebar} />;
        })}
      </ul>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex h-[4.5rem] items-center gap-3 px-6" aria-label={`${siteConfig.name} admin home`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2fcf7f] to-[#1570ef] font-display text-sm font-extrabold text-white">
        {siteConfig.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="sidebar-label truncate font-display text-lg font-bold">{siteConfig.name}</span>
    </Link>
  );
}

function SignOutButton() {
  return (
    <form action={signOutStaffAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-full border border-border bg-[#f9fafb] py-2.5 pr-3 pl-4 text-sm text-[#344054] transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
      >
        <LogOut className="size-[1.125rem] shrink-0" aria-hidden="true" />
        <span className="sidebar-label">Log out</span>
      </button>
    </form>
  );
}

export interface AdminUser {
  name: string;
  email: string;
  roleName: string;
}

export interface QuickAction {
  label: string;
  href: string;
}

function UserMenu({ user }: { user: AdminUser }) {
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-full py-1 pr-1 pl-2 hover:bg-[#f2f4f7] [&::-webkit-details-marker]:hidden"
        aria-label={`Account menu for ${user.name}`}
      >
        <span className="hidden text-right leading-tight md:block">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.roleName}</span>
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd6a8] to-[#f79a5c] text-sm font-bold text-[#5a2a07]">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-raised">
        <p className="truncate px-2.5 py-2 text-xs text-muted-foreground">{user.email}</p>
        <Link href="/admin/change-password" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface-muted">
          <KeyRound className="size-4" aria-hidden="true" /> Change password
        </Link>
        <form action={signOutStaffAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-danger hover:bg-danger-soft">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

function AddNewMenu({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-full bg-[#eaf2fe] px-3.5 text-sm font-medium text-[#1570ef] hover:bg-[#dbe8fd] [&::-webkit-details-marker]:hidden">
        Add New <Plus className="size-4" aria-hidden="true" />
      </summary>
      <ul className="absolute left-0 z-40 mt-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-raised">
        {actions.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="block rounded-md px-2.5 py-2 text-sm hover:bg-surface-muted">
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "reports", label: "Reports" },
  { key: "content", label: "Homepage Settings" },
] as const;

function TopTabs({ pathname, visible }: { pathname: string; visible: ReadonlySet<string> }) {
  const tabs = TABS.map((t) => ({ ...t, module: adminModules.find((m) => m.key === t.key)! })).filter((t) => t.module && visible.has(t.key));
  return (
    <nav aria-label="Shortcuts" className="hidden items-center gap-1 lg:flex">
      {tabs.map((t) => {
        const active = isActive(pathname, t.module);
        return (
          <Link
            key={t.key}
            href={adminHref(t.module)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "bg-[#1570ef] text-white" : "text-[#101828] hover:bg-[#f2f4f7]",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminChrome({
  children,
  visibleModules,
  user,
  quickActions,
  notice,
}: {
  children: ReactNode;
  visibleModules: readonly string[];
  user: AdminUser;
  quickActions: QuickAction[];
  /** System-level notice shown under the top bar (e.g. email not configured). */
  notice?: ReactNode;
}) {
  const visible = new Set(visibleModules);
  const pathname = usePathname();
  const sidebar = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  // Keep <html data-sidebar> in sync on client-side navigations into /admin (the boot script only runs on full loads).
  useEffect(() => {
    applySidebarState(sidebar);
  }, [sidebar]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (mobileOpen && !drawer.open) drawer.showModal();
    if (!mobileOpen && drawer.open) drawer.close();
  }, [mobileOpen]);

  const collapsed = sidebar === "collapsed";

  return (
    <div className="flex min-h-screen">
      <aside className="admin-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex">
        <Brand />
        <SidebarNav pathname={pathname} visible={visible} onExpandSidebar={collapsed ? () => setSidebarState("expanded") : undefined} />
        <div className="space-y-2 p-4">
          <SignOutButton />
        </div>
      </aside>

      <dialog
        ref={drawerRef}
        aria-label="Admin navigation"
        onClose={() => setMobileOpen(false)}
        onClick={(event) => {
          if (event.target === drawerRef.current) setMobileOpen(false);
        }}
        className="m-0 h-dvh max-h-dvh w-[min(18rem,85vw)] max-w-none bg-surface p-0 text-foreground backdrop:bg-black/40 lg:hidden"
      >
        {mobileOpen ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button type="button" onClick={() => setMobileOpen(false)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label="Close navigation">
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav pathname={pathname} visible={visible} />
            <div className="p-4">
              <SignOutButton />
            </div>
          </div>
        ) : null}
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col px-3 pt-3 sm:px-5 sm:pt-4">
        <header className="sticky top-3 z-30 flex h-14 items-center gap-2 rounded-2xl border border-border bg-surface/95 px-3 shadow-card backdrop-blur sm:top-4 sm:gap-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted lg:hidden"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarState(collapsed ? "expanded" : "collapsed")}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="size-[1.125rem]" /> : <PanelLeftClose className="size-[1.125rem]" />}
          </button>
          <Link href="/" target="_blank" title="View store" aria-label="View store (opens in a new tab)" className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground">
            <Globe className="size-[1.125rem]" aria-hidden="true" />
          </Link>
          <TopTabs pathname={pathname} visible={visible} />
          <AddNewMenu actions={quickActions} />
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>
        {notice ? <div className="mt-4">{notice}</div> : null}
        <main id="main-content" className="flex-1 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
