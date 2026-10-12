# Unified Commerce Platform

A single-business, multi-channel commerce and operations platform for a Bangladesh-based, multi-category seller: storefront, unified orders, inventory, CRM, couriers, invoices and reporting, with optional ERP modules later.

Project documents: [PRD](docs/PRD.md) · [SRS](docs/SRS.md) · [Requirements review](docs/REQUIREMENTS_REVIEW.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Routes](docs/ROUTES.md) · [Decisions](docs/DECISIONS.md) · **[Status](docs/STATUS.md)**

## Requirements
- Node.js 24 (`nvm use`) · pnpm 10 (`corepack enable`)
- PostgreSQL 16+

## Setup
```bash
nvm use
pnpm install                 # also runs prisma generate
cp .env.example .env         # set DATABASE_URL and TEST_DATABASE_URL
createdb ucp_dev && createdb ucp_test
pnpm db:deploy               # apply migrations
pnpm db:seed                 # business, system roles, dev owner (synthetic, dev only)
pnpm db:seed:catalog         # sample catalog, zones, stock, coupons WELCOME10/SEASON15, sample homepage text (dev only)
pnpm dev                     # http://localhost:3000
```

Sign in to the admin at `/admin/login` with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` (development only).
For a real environment create the first owner with `pnpm bootstrap:owner --email you@shop.com --name "Your Name"`, which prints a one-time temporary password.
`/styleguide` is development-only (404 in production builds).

## Scripts
| Script | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | Generate route types, then `tsc --noEmit` |
| `pnpm lint` | ESLint, zero warnings allowed |
| `pnpm test` | Unit tests |
| `pnpm test:integration` | Migrates the `*_test` database, then runs DB tests |
| `pnpm test:e2e` | Builds with `SHELL_PREVIEW=true`, then runs Playwright (desktop + mobile). First run: `pnpm exec playwright install chromium` |
| `pnpm check` | typecheck + lint + unit |
| `pnpm db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |
| `pnpm db:seed:catalog` | Sample multi-category catalog through the real services (dev/E2E only) |
| `pnpm bootstrap:owner` | Production-safe first-owner creation |

## Environment variables
| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | for integration tests | must differ from `DATABASE_URL` and end in `_test` |
| `APP_ENV` | no (development) | `development`, `test`, `staging` or `production` |
| `APP_URL` | no | must be https when `APP_ENV=production` |
| `LOG_LEVEL` | no (info) | pino level |
| `NEXT_PUBLIC_STORE_NAME` | no | storefront name until the settings UI exists |
| `SHELL_PREVIEW` | no (false) | enables `/styleguide` in a production build; rejected in production |
| `AUTH_SECRET` | yes | 32+ random characters (`openssl rand -base64 32`) |
| `E2E_DATABASE_URL` | for E2E | name must end in `_e2e`; reset and seeded on every run |
| `EMAIL_PROVIDER` | no (none) | only `none` until a provider is contracted: nothing is ever reported as sent |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | no (local) | `local` is development-only; `s3` is not implemented yet |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | dev seed | development owner account |

## Layout
```
src/app          routes: (storefront), account, admin, api
src/components   ui/ primitives, storefront/, admin/, account/, common/
src/config       site config, module registry (feature/status source of truth)
src/lib          env, db, logging, money, phone, csv, utils
src/modules      domain services (identity, catalog, audit…), the only layer touching the DB
src/proxy.ts     pre-render request checks (session redirect, unknown-path 404)
prisma/          schema, migrations, seed
tests/           unit, integration, e2e
```

## Deployment notes (so far)
- Production builds query the database at build time (prerendered pages read the cached catalog): `DATABASE_URL` must be reachable during `pnpm build`.
- Run behind a reverse proxy that overwrites `X-Forwarded-For` (used for rate limiting and audit IPs).
- Grant the application DB role DML only (no `TRUNCATE`/DDL on `audit_logs`), and run migrations with a separate role (D-022).
