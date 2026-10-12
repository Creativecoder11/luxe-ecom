# Route and Page Inventory

Legend: **R** = release · **G** = gate that makes it functional · Access: `public`, `customer` (own data only), `staff:<permission>`.

## Storefront (public)
| Route | Purpose | R | G | Access |
|---|---|---|---|---|
| `/` | Homepage: reference layout, owner content from Homepage settings, catalog-driven rails ✅ | 1 | 2 (data), 7 (CMS) ✅ | public |
| `/shipping-returns` | Delivery zones, fees, COD rules (from Settings) and returns policy ✅ | 1 | 7 | public |
| `/shop` | All products: filters, sort, pagination | 1 | 2 | public |
| `/categories/[slug]` | Category listing with category-specific facets | 1 | 2 | public |
| `/collections/[slug]` | Curated collection | 1 | 2 | public |
| `/brands/[slug]` | Brand page | 1 | 2 | public |
| `/products/[slug]` | Product detail: gallery, variant picker, stock, specs, delivery estimate, reviews | 1 | 2 | public |
| `/search` | Search results | 1 | 2 | public |
| `/cart` | Cart | 1 | 3 | public |
| `/checkout` | Checkout (guest or customer, BD address, COD) | 1 | 3 | public |
| `/checkout/success/[token]` | Order confirmation (unguessable token) | 1 | 3 ✅ | holder of token |
| `/track-order` | Order lookup by number + phone (rate-limited) | 1 | 4 | public |
| `/pages/[slug]` | Policies, FAQ, about, terms, privacy | 1 | 7 | public |
| `/contact` | Contact/support form | 1 | 5 | public |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Customer auth | 1 | 2 | public |

## Customer account
| Route | Purpose | R | G |
|---|---|---|---|
| `/account` | Overview | 1 | 2 |
| `/account/orders`, `/account/orders/[number]` | History, detail, tracking timeline, cancel/return | 1 | 4 |
| `/account/wishlist` | Wishlist | 1 | 3 |
| `/account/addresses` | Address book | 1 | 3 |
| `/account/returns` | Return requests | 1 | 4 |
| `/account/support` | Tickets | 1 | 5 |
| `/account/profile` | Profile, password, notification preferences/consent | 1 | 2/5 |

## Admin (staff, all require auth + permission)
| Route | Purpose | Permission | R | G |
|---|---|---|---|---|
| `/admin` | Dashboard from real records, per-card ranges ✅ | reports.view | 1 | 7 |
| `/admin/catalog/products` (+`/new`, `/[id]`) | Products, variants, media | catalog.* | 1 | 2 |
| `/admin/catalog/categories` | Category tree + attribute templates | catalog.* | 1 | 2 |
| `/admin/catalog/attributes` | Attribute definitions | catalog.* | 1 | 2 |
| `/admin/catalog/brands` | Brands (collections move to Gate 7) | catalog.* | 1 | 2 |
| `/admin/catalog/products/import` (+ `/export` CSV download) | CSV import/export | catalog.import / catalog.export | 1 | 2 |
| `/admin/orders` (+`/new`, `/[id]`) | Unified order queue, manual entry, detail | orders.* | 1 | 4 |
| `/admin/orders/confirmations` | Confirmation call queue | orders.update | 1 | 4 |
| `/admin/returns` | RMA queue | orders.update | 1 | 4 |
| `/admin/omnichannel` | Channel sources and connection status (manual until integrated) | settings.view | 1 | 4 |
| `/admin/inventory` (+`/movements`) | Stock, adjustments ✅, ledger ✅ | inventory.* | 1 | 3 |
| `/admin/purchasing` (+`/new`, `/[id]`, `/suppliers`) | Purchase orders, receiving, suppliers ✅ | purchasing.* | 1 | 3 |
| `/admin/couriers` (+ shipments, exceptions, remittances) | Courier ops | couriers.* | 1 | 6 |
| `/admin/crm/customers` (+`/[id]`), `/admin/crm/leads`, `/admin/crm/tasks` | CRM | customers.* | 1 | 5 |
| `/admin/support` (+ tickets, calls) | Helpdesk and call center | support.* | 1 | 5 |
| `/admin/messages` (+ templates, logs, campaigns) | Messaging | messaging.* | 1 | 6 |
| `/admin/invoices` | Invoices, credit notes | invoices.view | 1 | 4 |
| `/admin/payments` | Payments, COD collection | payments.* | 1 | 4 |
| `/admin/finance` | Expenses, COD settlements, purchase cost | finance.* | 1 | 7 |
| `/admin/reports` (+ sales, products, channels, inventory, couriers, crm) | Reports and exports | reports.* | 1 | 7 |
| `/admin/content` | Homepage settings ✅ (pages/blog later) | content.manage | 1 | 7 |
| `/admin/settings` (VAT, COD, checkout ✅), `/admin/settings/shipping` (delivery zones ✅), business identity / integrations later | Settings | settings.* | 1 | 3 / 7 |
| `/admin/marketing/coupons` | Coupons ✅ | campaigns.manage | 1 | 3 |
| `/admin/staff` | Staff and roles | staff.* | 1 | 2 |
| `/admin/audit-logs` | Audit trail | audit.view | 1 | 2 |

### Feature-gated (hidden or "Not available yet" until built)
`/admin/pos`, `/admin/wholesale` (R2) · `/admin/dealers`, `/admin/sales-reps`, `/admin/accounts`, `/admin/hr`, `/admin/production`, `/admin/import-export`, `/admin/approvals`, `/admin/supply-chain` (R3).

## API / route handlers
| Route | Purpose | G |
|---|---|---|
| `GET /api/health` | Liveness + DB check | 1 |
| ~~`/api/auth/[...all]`~~ | Not mounted: auth runs through server actions (D-023) | — |
| `POST /admin/catalog/products/[id]/media` | Validated product image upload (same-origin, 5 MB/file) | 2 |
| `GET /media/[...key]` | Serves registered product and content images (nosniff, sandbox CSP) | 2 |
| `POST /admin/content/upload` | Validated homepage image upload (same-origin, 5 MB) | 7 |
| `GET /api/exports/[report]` | Permission-gated CSV | 7 |
| `POST /api/webhooks/courier/[provider]` | Verified, idempotent courier webhooks | 6/9 |
| `POST /api/webhooks/payment/[provider]` | Verified payment webhooks | 9 |
| `POST /api/webhooks/sms/[provider]` | Delivery receipts | 6/9 |

Most mutations use **server actions**, which get Next.js origin checks for CSRF protection and Zod validation. Route handlers are reserved for webhooks, file streams and the auth endpoint.
