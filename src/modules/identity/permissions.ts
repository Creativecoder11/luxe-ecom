/**
 * Permission catalog (deny by default). Keys are `<module>.<verb>`; roles store key arrays.
 * The system role matrix mirrors docs/ARCHITECTURE.md §6 (pending owner sign-off).
 */

export const PERMISSION_GROUPS = {
  Catalog: {
    "catalog.view": "View products, categories, attributes and brands",
    "catalog.create": "Create products and catalog records",
    "catalog.update": "Edit products and catalog records",
    "catalog.publish": "Publish and unpublish products",
    "catalog.archive": "Archive products and catalog records",
    "catalog.delete": "Delete never-published drafts",
    "catalog.import": "Import products from CSV",
    "catalog.export": "Export products to CSV",
  },
  Inventory: {
    "inventory.view": "View stock levels and the movement ledger",
    "inventory.adjust": "Adjust stock with a reason",
    "purchasing.view": "View suppliers and purchase orders",
    "purchasing.manage": "Create purchase orders and receive goods",
    "purchasing.approve": "Approve purchase orders",
  },
  Orders: {
    "orders.view": "View orders",
    "orders.create": "Create manual (Facebook/phone) orders",
    "orders.update": "Confirm and progress orders, add notes",
    "orders.cancel": "Cancel orders",
    "orders.export": "Export orders",
    "returns.manage": "Process return requests",
  },
  Fulfilment: {
    "couriers.view": "View shipments",
    "couriers.manage": "Book and update shipments",
    "couriers.reconcile": "Reconcile COD remittances and courier charges",
  },
  Customers: {
    "customers.view": "View customer records (contact details masked)",
    "customers.pii": "See unmasked phone, email and address",
    "customers.manage": "Edit customers, tags, leads and follow-ups",
    "customers.export": "Export customers",
    "support.view": "View support tickets and call logs",
    "support.manage": "Handle tickets and log calls",
  },
  Marketing: {
    "messaging.view": "View message templates and delivery logs",
    "messaging.manage": "Edit templates and send transactional messages",
    "campaigns.manage": "Run consented marketing campaigns and manage coupons",
    "content.manage": "Manage banners, pages and homepage content",
  },
  Finance: {
    "payments.view": "View payments",
    "payments.record": "Record payments and COD collection",
    "payments.reconcile": "Reconcile payments",
    "payments.refund": "Issue refunds",
    "invoices.view": "View invoices",
    "invoices.issue": "Issue invoices and credit notes",
    "finance.view": "View finance reports",
    "finance.manage": "Record expenses and settlements",
  },
  Insights: {
    "reports.view": "View dashboards and reports",
    "reports.export": "Export reports",
  },
  System: {
    "settings.view": "View business settings",
    "settings.manage": "Change business settings and integrations",
    "staff.view": "View staff accounts",
    "staff.manage": "Create, suspend and re-role staff",
    "roles.manage": "Create and edit roles",
    "audit.view": "View the audit log",
    "audit.export": "Export the audit log",
  },
} as const;

type Groups = typeof PERMISSION_GROUPS;
export type Permission = { [G in keyof Groups]: keyof Groups[G] }[keyof Groups] & string;

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSION_GROUPS).flatMap(
  (group) => Object.keys(group) as Permission[],
);

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Drops unknown keys (e.g. a permission removed from the catalog) and duplicates. */
export function sanitizePermissions(values: readonly string[]): Permission[] {
  return [...new Set(values.filter(isPermission))].sort();
}

export const OWNER_ROLE_KEY = "owner";

export interface SystemRoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: OWNER_ROLE_KEY,
    name: "Business owner",
    description: "Full access, including staff, roles and settings. Cannot be edited.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "store_admin",
    name: "Store admin",
    description: "Runs day-to-day operations across all modules.",
    permissions: ALL_PERMISSIONS.filter((p) => !["roles.manage", "audit.export"].includes(p)),
  },
  {
    key: "catalog_manager",
    name: "Catalog manager",
    description: "Owns products, categories, attributes, brands and imports.",
    permissions: [
      "catalog.view", "catalog.create", "catalog.update", "catalog.publish", "catalog.archive",
      "catalog.delete", "catalog.import", "catalog.export", "inventory.view", "reports.view",
    ],
  },
  {
    key: "order_agent",
    name: "Order agent",
    description: "Creates and confirms orders, including Facebook and phone orders.",
    permissions: [
      "catalog.view", "inventory.view", "orders.view", "orders.create", "orders.update", "orders.cancel",
      "customers.view", "customers.pii", "customers.manage", "support.view", "support.manage",
      "couriers.view", "payments.view", "invoices.view",
    ],
  },
  {
    key: "courier_operator",
    name: "Courier operator",
    description: "Books shipments, handles delivery exceptions and returns.",
    permissions: [
      "orders.view", "orders.update", "returns.manage", "couriers.view", "couriers.manage",
      "customers.view", "support.view", "payments.view",
    ],
  },
  {
    key: "crm_agent",
    name: "CRM / call-center agent",
    description: "Customer records, follow-ups, tickets and confirmation calls.",
    permissions: [
      "orders.view", "customers.view", "customers.pii", "customers.manage", "support.view",
      "support.manage", "messaging.view", "reports.view",
    ],
  },
  {
    key: "marketing_manager",
    name: "Marketing manager",
    description: "Content, campaigns to consented customers and marketing reports.",
    permissions: [
      "catalog.view", "customers.view", "customers.export", "messaging.view", "messaging.manage",
      "campaigns.manage", "content.manage", "reports.view",
    ],
  },
  {
    key: "finance_officer",
    name: "Finance officer",
    description: "Payments, COD reconciliation, invoices, expenses and finance reports.",
    permissions: [
      "orders.view", "purchasing.view", "purchasing.approve", "couriers.view", "couriers.reconcile",
      "customers.view", "payments.view", "payments.record", "payments.reconcile", "payments.refund",
      "invoices.view", "invoices.issue", "finance.view", "finance.manage", "reports.view", "reports.export",
      "catalog.view", "inventory.view",
    ],
  },
  {
    key: "inventory_operator",
    name: "Inventory operator",
    description: "Stock adjustments, purchasing and goods receipts.",
    permissions: [
      "catalog.view", "inventory.view", "inventory.adjust", "purchasing.view", "purchasing.manage",
      "orders.view", "reports.view",
    ],
  },
];
