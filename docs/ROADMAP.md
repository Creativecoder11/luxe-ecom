# Implementation Roadmap

## 1. Phase ↔ gate ↔ release mapping (D-009)

| Master prompt phase | Playbook gate(s) | Release |
|---|---|---|
| Phase 0: Requirements & architecture | Gate 0 | — |
| Phase 1: Foundation & UI | Gate 1 | R1 |
| Phase 2: Functional commerce | Gates 2, 3 (+ customer side of 4) | R1 |
| Phase 3: Core business operations | Gates 4, 5, 6 (manual courier part), 7 | R1 |
| Phase 6 (first pass): QA, security, deployment | Gate 8 → **Release 1 launch** | R1 |
| Phase 4: Automation & connectors | Gate 6 (provider part), Gate 9 | R2 |
| Phase 5: Advanced modules | Gate 9 (POS, wholesale, multi-warehouse), Gate 10 (ERP) | R2 / R3 |
| Phase 6 (repeated) | Gate 8 checklist re-run per release | each |

## 2. Gates and work packages

Each work package (WP) is a small, reviewable change. A WP counts as done only when typecheck, lint, tests and build pass and the results are recorded in [STATUS.md](STATUS.md).

### Gate 1: Foundation and design system
- WP1.1 Scaffold Next.js 16 / TS strict / Tailwind 4 / ESLint / pnpm / `.nvmrc`
- WP1.2 Env validation (Zod), pino logger, security headers, `/api/health`
- WP1.3 Prisma 7 + pg adapter, initial migration (Business, BusinessSettings, AuditLog, OutboxEvent), seed script
- WP1.4 Lib primitives with unit tests: money (minor units), BD phone normalization, CSV-safe cell
- WP1.5 Design tokens and UI primitives (Button, Input, Select, Textarea, Checkbox, Label/Field, Badge, Card, Table, EmptyState, Skeleton, Alert, Dialog, Toast)
- WP1.6 Module registry, storefront shell (header/search/nav/cart/wishlist/footer, mobile menu), account shell, admin shell (collapsible persistent sidebar, topbar, mobile drawer)
- WP1.7 Vitest and Playwright configuration with smoke tests

### Gate 2: Identity, permissions and catalog
- WP2.1 Better Auth (staff + customer), sessions, rate limits, password reset (email provider port; manual/unconfigured), optional TOTP for staff
- WP2.2 Roles/permissions tables, `can(actor, perm, scope)` service, admin route guards, audit service, staff management UI
- WP2.3 Category tree, brands, collections, attribute definitions, category templates
- WP2.4 Product CRUD with typed attribute validation, variants generated from axes, SKU uniqueness, media upload (StorageDriver), publish/archive/duplicate
- WP2.5 Storefront catalogue: shop, category pages with facets from filterable attributes, product detail with variant picker, search (Postgres full-text and trigram)
- WP2.6 CSV import (dry-run validation report) and export (permission plus formula-injection safe)
- WP2.7 Seeds: cosmetics (shades), clothing (size × color), gadgets (specs/model); tests for SKU uniqueness and access control

### Gate 3: Inventory, purchasing and checkout
- WP3.1 Warehouse, StockBalance, StockMovement ledger, adjustments with reasons, low-stock thresholds
- WP3.2 Suppliers, POs, goods receipts (moving average cost)
- WP3.3 Cart (guest + customer merge), wishlist, coupons
- WP3.4 Shipping zones (BD division/district/upazila), COD eligibility, tax classes
- WP3.5 Checkout: server-recalculated totals, idempotent atomic order creation, reservations, snapshots
- WP3.6 Concurrency integration tests (two buyers for the last unit; staff order vs web order)

### Gate 4: OMS and channel capture
- WP4.1 Admin order queue (filter/sort/paginate/bulk), detail, status machine, history, notes
- WP4.2 Manual order entry (Facebook/phone) with customer lookup/dedup and duplicate-order warning
- WP4.3 Confirmation queue and tasks; cancellation (release stock); return/RMA with inspection and restock decision
- WP4.4 Payment records (COD lifecycle), invoices (sequence, printable/PDF), packing slip, credit notes
- WP4.5 Customer account: order history, tracking timeline, cancel/return requests, addresses

### Gate 5: CRM and call center
- WP5.1 Customer 360 (identities, consent, tags, notes, timeline linked to OMS events)
- WP5.2 Leads/inquiries, follow-up tasks, assignment, reminders
- WP5.3 Support tickets (customer + staff), call logs with dispositions, confirmation-call queue

### Gate 6: Couriers and messaging (manual + adapter framework)
- WP6.1 Courier adapter port, manual booking/tracking, shipment state machine, exceptions, RTO
- WP6.2 COD remittance and courier charge reconciliation
- WP6.3 Outbox + pg-boss worker, templates, dispatch log, retries, consent checks; providers report `UNCONFIGURED`
- WP6.4 First real courier/SMS provider **only if credentials are supplied** (sandbox tests: signature, duplicate, timeout)

### Gate 7: Dashboard, reports and launch polish
- WP7.1 Metric definitions doc + reporting service (gross/net sales, AOV, COD outstanding, return/RTO rate, courier SLA, repeat rate, estimated gross profit)
- WP7.2 Admin dashboard (date ranges, charts from DB), report pages, CSV exports
- WP7.3 CMS: banners, content pages, homepage sections, SEO (sitemap, canonical, JSON-LD), policy/FAQ/contact pages
- WP7.4 Expenses register and finance operational reports

### Gate 8: Security and release audit (Release 1)
RBAC/IDOR test suite, race tests, upload/CSRF/XSS review, secrets, backups and restore drill, staging deployment, production runbook, rollback test, truthful release report.

### Gate 9: Release 2 (each behind a flag, after provider approval)
Meta permitted APIs · live courier APIs and webhooks · payment gateway (bKash/Nagad/SSLCommerz) with refunds and reconciliation · consent-governed bulk SMS and autocall · multi-warehouse transfers · advanced PO · POS · wholesale price lists · money columns → `bigint` review.

### Gate 10: Release 3 (separate bounded projects)
Dealer/distribution/SR · production/BOM · supply chain · import/export and LC document tracking · HR · approvals · general ledger · multi-business tenancy. Each needs its own sign-off, schema, RBAC, tests and rollout plan.

## 3. MVP (Release 1) acceptance criteria (F)

Derived from PRD §18 and SRS §13. Each one must be shown by an automated test or a recorded manual test against seeded synthetic data.

1. An admin creates a cosmetic (shade variants plus batch/expiry), an apparel item (size × color) and a gadget (model/spec plus warranty) with validated, distinct attributes and **no schema change**.
2. An admin publishes/unpublishes, changes the category, adjusts stock and sets a sale price. A customer sees only published products, filters by category facets and searches.
3. A guest or registered customer completes a COD checkout. Totals are recomputed server-side, and a tampered client price is ignored.
4. Two concurrent checkouts for the last unit result in one order and one clean out-of-stock error. Available stock never goes negative, and every ledger row carries a reason and actor.
5. A website order and a staff-entered `FACEBOOK_MANUAL` order for the same phone number land in one order queue and one customer timeline, without duplicating the customer. Re-submitting the same order (idempotency key) does not create a second order.
6. The order moves through Confirmed → Processing → Packed → Shipped (manual courier, tracking code) → Delivered. Invalid transitions are rejected. COD payment moves from COD_UNPAID to COD_COLLECTED to REMITTED independently of delivery.
7. Cancellation releases the reservation. A return goes through inspection, and restock happens only when the condition is approved.
8. The invoice number is sequential and immutable, the invoice is printable, and its totals match the order snapshot.
9. A CRM agent assigns a follow-up, opens a ticket and logs a call. An agent without `customers.pii` sees masked phone numbers. A customer cannot read another customer's order (IDOR test).
10. Dashboard and report figures equal hand-computed totals from a fixture dataset, metric definitions are shown, and CSV exports are permission-gated and formula-injection safe.
11. Courier, SMS, email, payment and Meta integrations without credentials show **Unconfigured / Manual** and never record a sent or delivered state.
12. R2/R3 modules are hidden or labelled "Not available yet".
13. Typecheck, lint, unit/integration/E2E tests and production build pass in CI. A backup-restore drill is documented with evidence.
14. Core flows are usable at 360 px and at desktop width. The Lighthouse accessibility score is ≥ 90 on the home, product, checkout and admin order pages.

## 4. First small implementation task (G)

**WP1.1–WP1.4: Project scaffold and verified foundations.** Create the Next.js 16 project (strict TS, Tailwind 4, ESLint, pnpm, Node 24), add environment validation, the structured logger, the Prisma 7 initial migration and the money/phone/CSV utilities with unit tests, and run typecheck, lint, test and build. This is followed directly by WP1.5–WP1.7 (design system and shells) to complete Gate 1.
