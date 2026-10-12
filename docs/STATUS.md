# Implementation Status

Last updated: 2026-10-12 · Current gate: **Gate 3 complete, awaiting review** · Next: Gate 4 (order management: confirm → pack → ship → deliver, manual Facebook/phone orders, invoices)

Legend: ✅ implemented and tested · 🟡 partial · 🧱 shell (layout only, clearly labelled) · ⏳ planned · ⛔ blocked (external dependency) · 💤 deferred (later release)

## Gate 0: Requirements and architecture ✅
| Item | Status | Where |
|---|---|---|
| Requirements and gap summary, conflicts | ✅ | [REQUIREMENTS_REVIEW.md](REQUIREMENTS_REVIEW.md) |
| Architecture, data model, dependency map, permission matrix | ✅ (draft for sign-off) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Roadmap, MVP acceptance criteria | ✅ | [ROADMAP.md](ROADMAP.md) |
| Route inventory | ✅ | [ROUTES.md](ROUTES.md) |
| Decision log | ✅ | [DECISIONS.md](DECISIONS.md) |

## Gate 1: Foundation and design system ✅
| Item | Status | Evidence |
|---|---|---|
| Next.js 16.4 / React 19.3 / TS 6.0 strict (+`noUncheckedIndexedAccess`) / Tailwind 4.3 / pnpm / Node 24 | ✅ | typecheck, build |
| ESLint (next core-web-vitals + TS) with a Prisma import boundary rule | ✅ | lint; the rule was checked with a probe file |
| Zod-validated environment (production rules: https APP_URL, no shell preview) | ✅ | `tests/unit/env.test.ts` |
| Structured logging (pino) with credential/PII redaction | ✅ | used by `/api/health` |
| Security headers (CSP, HSTS in prod, XFO, nosniff, referrer, permissions) | ✅ | E2E + curl on the production build |
| Prisma 7 + pg adapter, first migration (Business, BusinessSettings, AuditLog, OutboxEvent) | ✅ | `prisma/migrations/20261011080414_foundation` |
| Append-only audit log (DB trigger), outbox idempotency key + CHECK | ✅ | `tests/integration/foundation.test.ts` |
| Dev seed (single business) | ✅ | `pnpm db:seed` |
| Money (integer minor units, allocation, ৳ lakh formatting) | ✅ | `tests/unit/money.test.ts` |
| BD mobile normalization (Bangla digits, E.164) and PII masking | ✅ | `tests/unit/phone.test.ts` |
| CSV export with formula-injection protection | ✅ | `tests/unit/csv.test.ts` |
| Design tokens (storefront + admin themes) and UI primitives | ✅ | `/styleguide` (dev/preview only) |
| Module registry: release, build status, navigability | ✅ | `tests/unit/modules.test.ts` |
| Storefront shell: header, search, mobile menu, footer, home, shop, search, cart | 🧱 | honest empty states; data arrives in Gates 2–3 |
| Customer account shell | 🧱 | 404 in production until Gate 2 auth |
| Admin shell: persistent collapsible sidebar, mobile drawer, dashboard layout | 🧱 | no figures shown; 404 in production until Gate 2 |
| Real HTTP 404s for unknown/unreleased admin and account paths | ✅ | `src/proxy.ts`, E2E (D-020) |
| `/api/health` (DB reachability, no detail leakage) | ✅ | E2E |
| Vitest (unit + integration projects), Playwright (desktop + mobile) | ✅ | see results below |

## Gate 2: Identity, permissions and catalog ✅
| Item | Status | Evidence |
|---|---|---|
| Staff and customer accounts (Better Auth, DB sessions, scrypt on the libuv pool) | ✅ | `tests/integration/identity.test.ts`, E2E admin + customer flows |
| Staff sign-in, forced change of temporary passwords, sign-out, session revocation on suspend/reset | ✅ | E2E `admin.spec.ts`, integration |
| Customer register / sign-in / profile / change password; staff accounts rejected on customer sign-in | ✅ | E2E `customer-auth.spec.ts` |
| Password reset: honest "email not configured"; in dev the link is logged, never claimed as sent | ✅ (email provider ⛔ not contracted) | E2E |
| Rate limiting (Postgres, fixed window) on sign-in, registration, password reset | ✅ | integration |
| Permission catalog (50 permissions), 9 system roles from the matrix, custom roles, privilege-escalation guard, last-owner guard | ✅ | integration |
| Staff management (create, re-role, suspend, reset password) and role editor UI | ✅ | E2E |
| Audit log: all privileged writes, viewer with filters | ✅ | integration + E2E |
| Proxy: optimistic session redirects + real 404 for unknown admin/account paths | ✅ | E2E |
| Staff MFA (TOTP) | ⏳ deferred to Gate 8 (D-027) | |
| Attribute definitions (6 types, validation rules, options with swatches, variant/filter/search flags) | ✅ | unit + integration |
| Category tree with inherited attribute templates, cycle prevention, hide/delete rules | ✅ | integration |
| Brands | ✅ | integration |
| Products: typed attributes, variant matrix, SKU/barcode uniqueness, exact prices, cost, publish rules, duplicate, archive/restore, delete only never-published drafts | ✅ | 20 integration tests; E2E |
| Cosmetics (shades), apparel (size × color), gadgets (specs, warranty) without schema changes | ✅ | `catalog.test.ts`, sample catalog |
| Product images (magic-byte validation, random keys, safe serving, alt text, ordering) | ✅ local storage · ⛔ S3 driver not implemented (needs bucket) | E2E upload test |
| CSV export (formula-safe) and validate-first import | ✅ | `catalog-csv.test.ts` |
| Storefront: home tiles/new arrivals, shop, category, brand, search, facets, sort, pagination, product page with variant picker, JSON-LD, sitemap, robots | ✅ | E2E `catalog.spec.ts` |
| Storefront caching with `use cache` + tag invalidation on admin writes | ✅ | E2E (publish → visible immediately) |
| Collections | ⏳ moved to Gate 7 (merchandising) | |
| Cart / ordering | ✅ done in Gate 3 | |

## Gate 3: Inventory, purchasing, cart and COD checkout ✅
| Item | Status | Evidence |
|---|---|---|
| Owner-configured VAT: prices include/exclude VAT, tax classes and rates, BIN (D-028) | ✅ | pricing unit tests; VAT-exclusive integration test |
| Owner-configured delivery zones: districts, base fee for included weight, extra per kg, free-delivery threshold, estimate, "rest of Bangladesh" (D-029) | ✅ | pricing + integration tests |
| Cash on Delivery across Bangladesh, switchable globally/per zone, COD fee, maximum COD order (D-030) | ✅ | integration tests (disabled zone, limit) |
| Bangladesh divisions and 64 districts | ✅ | unit test |
| Warehouse, stock balances, append-only stock ledger, reasoned adjustments, low/out-of-stock views | ✅ | integration (ledger, negative-stock refusal, append-only) |
| Suppliers, purchase orders (draft → approve → receive), partial receipts, over-receipt guard, moving-average cost (D-016) | ✅ | integration |
| Cart (guest cookie + account merge on sign-in), quantity capped by stock, server-side prices only | ✅ | integration + E2E |
| Coupons (percent with cap, fixed, free delivery; min order, dates in Dhaka time, total and per-customer limits) | ✅ | integration (limit holds under concurrency) |
| Wishlist | ✅ | E2E (via product page) |
| Checkout: live delivery quote by district, atomic order (snapshots, reservations, coupon redemption, COD payment, history, outbox event), idempotent | ✅ | integration (10 concurrent buyers for 3 units → exactly 3 orders; double submit → 1 order; tampered prices ignored) |
| Order confirmation page (unguessable token), My orders list/detail (IDOR-safe) | ✅ | E2E |
| Admin: settings, delivery zones, inventory, ledger, purchasing, suppliers, coupons | ✅ | E2E smoke + integration |
| Admin orders | 🟡 read-only list/detail (contact masked without `customers.pii`); workflows in Gate 4 | E2E |
| Address book (saved addresses) | ⏳ checkout prefills from the last order; managed address book in Gate 4 | |
| Reservation expiry for unconfirmed orders | ⏳ Gate 4 (needs the job worker) | |
| Upazila list | ⏳ free text for now (D-031) | |

## Design match: storefront and dashboard (owner request 2026-10-12) ✅
| Item | Status | Evidence |
|---|---|---|
| Storefront header (announcement bar, dark header, catalog/brand menus), hero banners, promo cards, category icon strip, product grid with colour swatches, banner slider, spotlight list, image tiles, masonry gallery, category tabs carousel, feature banner with product strip, statement + computed store figures, coupon countdown, split showcases, marquee, dark footer with newsletter | ✅ | screenshots at 1440 px and 390 px; E2E `storefront.spec.ts` |
| Admin → Homepage settings: 15 independently saved sections, image upload, link validation, audit log (D-035) | ✅ (blog/pages ⏳ Gate 7) | integration `content-reports.test.ts`; E2E save + upload |
| `/shipping-returns` page from configured zones/COD + owner returns policy | ✅ | E2E |
| Newsletter sign-up stored, nothing emailed (D-037) | ✅ | integration + E2E |
| Admin chrome: gradient active pill, collapsible nav groups, top-bar tabs, Add New menu, truthful "email not configured" banner | ✅ | E2E admin navigation |
| Dashboard from real records: sales/orders/AOV with like-for-like deltas, estimated gross profit, customers, cart abandonment, repeat purchase, revenue per customer, orders by channel, new customers, revenue vs gross profit by year, order status, monthly sales by channel, suppliers/products/brands/categories/stock cards, top categories and products (D-036) | ✅ | integration (figures equal sums over seeded orders; zeros before any sale; permission) + E2E |
| Conversion rate, net profit, product ratings | ⛔ shown as "not tracked" until analytics, expenses and reviews exist | |

## Release 1 modules
| Module | Gate | Status |
|---|---|---|
| Identity, staff roles, RBAC, audit service | 2 | ✅ (MFA ⏳ Gate 8) |
| Catalog: categories, attributes, products, variants, media, import/export | 2 | ✅ (collections ⏳ Gate 7, S3 ⛔) |
| Inventory ledger, reservations, purchasing | 3 | ✅ |
| Cart, wishlist, coupons, COD checkout | 3 | ✅ |
| OMS, manual Facebook/phone orders, returns, invoices, payments | 4 | ⏳ |
| CRM, tickets, call logs | 5 | ⏳ |
| Couriers (manual) and messaging outbox | 6 | ⏳ (live providers ⛔ until credentials exist) |
| Dashboard, reports, CMS, finance register | 7 | 🟡 dashboard + homepage CMS done; reports, pages/blog, finance ⏳ |
| Security and release audit, staging, backups | 8 | ⏳ |

## Release 2 / 3
POS, wholesale, live couriers/payments/SMS/Meta, multi-warehouse (R2) and dealers, SR, accounting ledger, production, import/LC, HR, approvals (R3): 💤 deferred. They are not navigable and their URLs return 404.

## Verification log (Gate 1, 2026-10-11, Node 24.14.1, PostgreSQL 16.14 local)
| Command | Result |
|---|---|
| `pnpm typecheck` (`next typegen && tsc --noEmit`) | ✅ pass, 0 errors |
| `pnpm lint` (`eslint --max-warnings=0`) | ✅ pass, 0 warnings |
| `pnpm test` (unit) | ✅ 56/56 tests, 5 files |
| `pnpm test:integration` (migrates `ucp_test`, real Postgres) | ✅ 5/5 tests |
| `pnpm build` | ✅ 40 routes (static / partial prerender; `/api/health` dynamic) |
| `pnpm test:e2e` (production build, Chromium desktop + Pixel 7) | ✅ 20 passed, 4 skipped (device-specific tests run only on their viewport) |
| Manual: production build without `SHELL_PREVIEW` | ✅ `/admin`, `/account`, `/styleguide` → 404; `/api/health` → 200 |

Problems found and fixed during verification:
1. Unknown admin paths returned a 200 soft 404 on the first request (PPR App Shell). Fixed with `src/proxy.ts` and recorded as D-020.
2. A stale `next-server` process from an earlier build was still bound to the test port and served old HTML. It was not a code defect. Manual smoke tests now stop servers by port.

Not yet done (and not claimed): CI pipeline, staging deployment, backup/restore drill, accessibility/Lighthouse audit, object storage driver, job worker (pg-boss). These belong to Gates 2–8.

## Verification log (Gate 2, 2026-10-12, Node 24.14.1, PostgreSQL 16.14 local)
| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ pass |
| `pnpm lint` | ✅ pass, 0 warnings |
| `pnpm test` (unit) | ✅ 105/105 |
| `pnpm test:integration` (real Postgres) | ✅ 49/49 (foundation 5, identity 16, catalog 20, CSV 8) |
| `pnpm test:e2e` (fresh production build, E2E DB reset + seeded, 2 workers) | ✅ 61 passed, 4 skipped (device-specific) |

Problems found and fixed during Gate 2:
1. **Swallowed prerender signal**: `getSession()` caught Next's prerender postponement, which could bake a login redirect into static shells. Fixed with `unstable_rethrow`.
2. **Event-loop blocking password hashing** (pure-JS scrypt in the server bundle). Diagnosed with event-loop monitoring and a CPU profile, fixed with native scrypt (D-024).
3. **React 19 form reset** cleared emails after a failed sign-in. Non-secret values are now echoed back.
4. **Newly published products failed to render** (App Shell bailout for params not known at build). Storefront dynamic pages are now per-request routes; unknown slugs are soft 404s with `noindex` (D-020 update).
5. Global CSP overrode the media route's sandbox CSP; a specific header rule now applies.
6. E2E parallelism capped at 2 workers: a CPU profile showed one `next start` process saturated at 4 workers on a laptop. Set `E2E_WORKERS` to change it.

## Verification log (Gate 3, 2026-10-12)
| Command | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` | ✅ pass / ✅ 0 warnings |
| `pnpm test` (unit) | ✅ 120/120 |
| `pnpm test:integration` (real Postgres) | ✅ 65/65 (adds commerce 15: concurrency, idempotency, VAT, COD rules, purchasing) |
| `pnpm test:e2e` (fresh production build, 2 workers) | ✅ 71 passed, 4 skipped (device-specific), 0 server errors |

Problems found and fixed during Gate 3:
1. **Checkout transaction timeout under load**: Prisma's 5 s interactive-transaction default failed an order at 7.1 s. Fixed with an explicit budget (D-032).
2. **Product editor N+1 queries**: category templates were resolved one query at a time. They now take 2 queries resolved in memory, with an equivalence test.
3. Account-to-guest-order linking by phone was designed out (D-033).
4. Several E2E runs failed only while macOS background services pushed the load average above 100 (up to 179). Event-loop monitoring showed 2–5.5 s OS-level stalls. On a calm machine the suite passes with 1 and 2 workers. The expectation timeout was raised to 15 s.
