/**
 * Module registry: the single source of truth for what exists, which release it belongs to
 * and how far it is built (D-013). Navigation, placeholder pages and docs/STATUS.md follow it.
 *
 * Build status meanings:
 *   planned      no code yet
 *   shell        layout/navigation only, no data or behaviour
 *   partial      some workflows work against the database
 *   implemented  all scoped workflows work against the database
 *   tested       implemented + automated tests cover acceptance criteria
 *
 * Never set a status above what the code and tests actually support.
 */

export type BuildStatus = "planned" | "shell" | "partial" | "implemented" | "tested";
export type Release = 1 | 2 | 3;

export type AdminGroup =
  | "Overview"
  | "Sales"
  | "Catalog"
  | "Inventory"
  | "Fulfilment"
  | "Customers"
  | "Marketing"
  | "Finance"
  | "Insights"
  | "System"
  | "Later releases";

export interface AdminModule {
  key: string;
  /** Permission required to see the module (navigation and pages). */
  permission: string;
  label: string;
  /** Path under /admin; "" is the dashboard. */
  path: string;
  group: AdminGroup;
  release: Release;
  /** Playbook gate that makes it functional. */
  gate: number;
  status: BuildStatus;
  summary: string;
  /** Needs an external provider contract/credentials before it can be active. */
  requiresProvider?: boolean;
}

export const ADMIN_GROUP_ORDER: readonly AdminGroup[] = [
  "Overview",
  "Sales",
  "Catalog",
  "Inventory",
  "Fulfilment",
  "Customers",
  "Marketing",
  "Finance",
  "Insights",
  "System",
  "Later releases",
];

export const adminModules: readonly AdminModule[] = [
  { key: "dashboard", permission: "reports.view", label: "Dashboard", path: "", group: "Overview", release: 1, gate: 7, status: "partial", summary: "Live KPIs computed from orders, payments, stock, couriers and CRM records." },

  { key: "orders", permission: "orders.view", label: "Orders", path: "orders", group: "Sales", release: 1, gate: 4, status: "partial", summary: "Unified queue for website, Facebook-manual and phone orders, with status history, notes and invoices." },
  { key: "returns", permission: "returns.manage", label: "Returns", path: "returns", group: "Sales", release: 1, gate: 4, status: "planned", summary: "Return requests, inspection, restock decisions and refund or credit outcomes." },
  { key: "omnichannel", permission: "orders.view", label: "Channels", path: "omnichannel", group: "Sales", release: 1, gate: 4, status: "planned", summary: "Order sources and their connection state. Facebook is manual entry until Meta APIs are approved." },

  { key: "products", permission: "catalog.view", label: "Products", path: "catalog/products", group: "Catalog", release: 1, gate: 2, status: "implemented", summary: "Multi-category products, variants, SKUs, media, pricing, SEO and publishing." },
  { key: "categories", permission: "catalog.view", label: "Categories", path: "catalog/categories", group: "Catalog", release: 1, gate: 2, status: "implemented", summary: "Category tree with category-specific attribute templates." },
  { key: "attributes", permission: "catalog.view", label: "Attributes", path: "catalog/attributes", group: "Catalog", release: 1, gate: 2, status: "implemented", summary: "Typed attribute definitions (size, shade, material, specs, warranty…)." },
  { key: "brands", permission: "catalog.view", label: "Brands", path: "catalog/brands", group: "Catalog", release: 1, gate: 2, status: "implemented", summary: "Brands shown on products and as storefront filters. Curated collections arrive with merchandising (Gate 7)." },

  { key: "inventory", permission: "inventory.view", label: "Inventory", path: "inventory", group: "Inventory", release: 1, gate: 3, status: "implemented", summary: "Stock by variant and warehouse, movement ledger, adjustments and low-stock alerts." },
  { key: "purchasing", permission: "purchasing.view", label: "Purchasing", path: "purchasing", group: "Inventory", release: 1, gate: 3, status: "implemented", summary: "Suppliers, purchase orders and goods receipts." },

  { key: "couriers", permission: "couriers.view", label: "Couriers", path: "couriers", group: "Fulfilment", release: 1, gate: 6, status: "planned", summary: "Manual courier booking and tracking, exceptions, RTO and COD remittance. Live APIs need provider credentials.", requiresProvider: true },

  { key: "crm", permission: "customers.view", label: "Customers", path: "crm/customers", group: "Customers", release: 1, gate: 5, status: "planned", summary: "Unified customer records, tags, consent, leads, follow-ups and timeline." },
  { key: "support", permission: "support.view", label: "Support", path: "support", group: "Customers", release: 1, gate: 5, status: "planned", summary: "Tickets, call logs and confirmation-call queue." },

  { key: "messages", permission: "messaging.view", label: "Messages", path: "messages", group: "Marketing", release: 1, gate: 6, status: "planned", summary: "Templates, delivery logs and retries. SMS/email stay unconfigured until a provider is connected.", requiresProvider: true },
  { key: "coupons", permission: "campaigns.manage", label: "Coupons", path: "marketing/coupons", group: "Marketing", release: 1, gate: 3, status: "implemented", summary: "Discount codes with usage limits." },
  { key: "content", permission: "content.manage", label: "Homepage settings", path: "content", group: "Marketing", release: 1, gate: 7, status: "partial", summary: "Homepage banners, sections, announcement, social links and the returns policy. Blog and other pages come later." },

  { key: "payments", permission: "payments.view", label: "Payments", path: "payments", group: "Finance", release: 1, gate: 4, status: "planned", summary: "COD collection and remittance tracking, separate from order status." },
  { key: "invoices", permission: "invoices.view", label: "Invoices", path: "invoices", group: "Finance", release: 1, gate: 4, status: "planned", summary: "Sequential invoices, printable copies and credit notes." },
  { key: "finance", permission: "finance.view", label: "Finance", path: "finance", group: "Finance", release: 1, gate: 7, status: "planned", summary: "Expenses, COD settlements and purchase cost. Operational reports, not formal accounts." },

  { key: "reports", permission: "reports.view", label: "Reports", path: "reports", group: "Insights", release: 1, gate: 7, status: "planned", summary: "Sales, product, channel, inventory, courier and CRM reports with published definitions." },

  { key: "settings", permission: "settings.view", label: "Settings", path: "settings", group: "System", release: 1, gate: 3, status: "partial", summary: "VAT, Cash on Delivery, checkout rules and delivery zones. Business identity and integrations come later." },
  { key: "staff", permission: "staff.view", label: "Staff & roles", path: "staff", group: "System", release: 1, gate: 2, status: "implemented", summary: "Staff accounts, roles and granular permissions." },
  { key: "audit-logs", permission: "audit.view", label: "Audit log", path: "audit-logs", group: "System", release: 1, gate: 2, status: "implemented", summary: "Append-only record of privileged actions." },

  { key: "pos", permission: "orders.view", label: "POS", path: "pos", group: "Later releases", release: 2, gate: 9, status: "planned", summary: "Retail point of sale with shifts and barcode scanning." },
  { key: "wholesale", permission: "orders.view", label: "Wholesale", path: "wholesale", group: "Later releases", release: 2, gate: 9, status: "planned", summary: "Wholesale customers and price lists." },
  { key: "dealers", permission: "orders.view", label: "Dealers", path: "dealers", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Dealer and distributor management." },
  { key: "sales-reps", permission: "orders.view", label: "Sales reps", path: "sales-reps", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Sales representative routes and assignments." },
  { key: "accounts", permission: "finance.view", label: "Accounting", path: "accounts", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "General ledger, journals, AR/AP." },
  { key: "production", permission: "inventory.view", label: "Production", path: "production", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Bills of materials and work orders." },
  { key: "import-export", permission: "purchasing.view", label: "Import / LC", path: "import-export", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Import/export shipments and LC document tracking." },
  { key: "hr", permission: "staff.view", label: "HR", path: "hr", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Employee records, attendance and leave." },
  { key: "approvals", permission: "settings.view", label: "Approvals", path: "approvals", group: "Later releases", release: 3, gate: 10, status: "planned", summary: "Approval chains and internal workflow automation." },
];

export function adminHref(module: Pick<AdminModule, "path">): string {
  return module.path ? `/admin/${module.path}` : "/admin";
}

export function findAdminModuleByPath(path: string): AdminModule | undefined {
  return adminModules.find((m) => m.path === path);
}

/** Release 2/3 modules are never navigable until built (PRD §18). */
export function isNavigable(module: AdminModule): boolean {
  return module.release === 1 || module.status !== "planned";
}

export const STATUS_LABEL: Record<BuildStatus, string> = {
  planned: "Not built yet",
  shell: "Layout preview",
  partial: "Partially available",
  implemented: "Available",
  tested: "Available",
};

/** Customer account sections (all become functional in the gates listed). */
export const accountSections: readonly { label: string; href: string; gate: number; status: BuildStatus }[] = [
  { label: "Overview", href: "/account", gate: 2, status: "implemented" },
  { label: "Orders", href: "/account/orders", gate: 3, status: "implemented" },
  { label: "Wishlist", href: "/account/wishlist", gate: 3, status: "implemented" },
  { label: "Addresses", href: "/account/addresses", gate: 3, status: "planned" },
  { label: "Returns", href: "/account/returns", gate: 4, status: "planned" },
  { label: "Support", href: "/account/support", gate: 5, status: "planned" },
  { label: "Profile", href: "/account/profile", gate: 2, status: "implemented" },
];

/** Admin routes reachable without a staff session. */
export const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set(["/admin/login"]);

/**
 * Whether a path under /admin or /account maps to a registered, navigable section.
 * Used by src/proxy.ts to return a real HTTP 404 before rendering (a streamed notFound()
 * can only produce a soft 404 under Partial Prerendering).
 */
export function isKnownShellPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/admin" || path === "/account") return true;
  if (PUBLIC_ADMIN_PATHS.has(path)) return true;
  if (path === "/admin/change-password") return true;
  if (path.startsWith("/admin/")) {
    return adminModules.some((m) => {
      if (!m.path || !isNavigable(m)) return false;
      const href = adminHref(m);
      // Unbuilt modules have exactly one placeholder page; built modules own their sub-routes.
      return m.status === "planned" ? path === href : path === href || path.startsWith(`${href}/`);
    });
  }
  if (path.startsWith("/account/")) {
    // Built sections own their sub-routes (e.g. /account/orders/ORD-…); planned ones have one placeholder.
    return accountSections.some(
      (s) => path === s.href || (s.href !== "/account" && s.status !== "planned" && path.startsWith(`${s.href}/`)),
    );
  }
  return true;
}
