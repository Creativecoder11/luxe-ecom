# Requirements Review and Gap Analysis (Phase 0 / Gate 0)

Sources reviewed (11 Oct 2026): `docs/PRD.md` v2.0, `docs/SRS.md` v2.0, `docs/Claude_Code_Development_Playbook.docx` v2.0, the master build prompt, the admin dashboard reference (`Dashboard home.pdf`) and the storefront reference screenshot (electronics theme).

Priority order when sources disagree: **PRD/SRS → Playbook → master prompt → visual references**, unless a decision in [DECISIONS.md](DECISIONS.md) says otherwise.

## 1. Summary of what is being built

A single-business, multi-channel commerce and operations platform for a Bangladesh-based seller of mixed categories (beauty, fashion, gadgets, home and others). Release 1 is commerce, unified order management (OMS), inventory and purchasing essentials, CRM, manual courier handling, invoices, COD and dashboards. Release 2 adds connected integrations, POS and wholesale. Release 3 adds optional ERP modules. The system is tenant-*ready* (it has a `businessId` boundary) but is **not** a SaaS product or a marketplace.

## 2. Conflicts found and proposed resolutions

| # | Conflict | Sources | Proposed resolution | Status |
|---|----------|---------|---------------------|--------|
| C1 | The dashboard reference is a **multivendor marketplace** admin (Sellers, Top Sellers, Seller products/brands, Affiliate, Club Point, Wholesale "sellers"). The PRD defines a single-business model that is not a marketplace. | PDF vs PRD §1, README | Keep the visual language (KPI cards, chart cards, tables, collapsible sidebar). Replace the seller widgets with channel/source, courier and COD widgets. Drop Affiliate and Club Point; they are not in the PRD. | Proposed (D-007) |
| C2 | The dashboard reference shows **"Net Profit"**, and the master prompt's dashboard implies profit KPIs. PRD §13/§15 forbids presenting net profit before ledger, expense allocation and tax are in place. | PDF, master prompt vs PRD | Show **"Estimated gross profit"** with its costing method disclosed. Net profit appears only once the R2/R3 ledger exists. | Proposed (D-007) |
| C3 | The storefront reference is **electronics-specific**. | Screenshot vs PRD §16 | Use it as an aesthetic reference only: editorial hero, category tiles, product rails and countdown campaign blocks. Copy, imagery and attributes are brand-neutral and category-agnostic. | Proposed (D-008) |
| C4 | Order statuses: the master prompt lists 10 statuses. The SRS lists DRAFT, PENDING_CONFIRMATION, …, RETURN_REQUESTED, RETURN_APPROVED, PARTIALLY_RETURNED. | Master vs SRS §9 | Adopt the SRS superset. The master prompt's "pending" maps to `PENDING_CONFIRMATION`. Shipment and payment statuses stay separate state machines. | Proposed (D-006) |
| C5 | Phases: the master prompt has Phases 0–6 with POS/wholesale and all ERP modules in Phase 5. The docs use Gates 0–10 and Releases 1–3, with POS/wholesale in R2 and ERP in R3. | Master vs Playbook/README | Follow the Playbook gates and map the master phases onto them (see [ROADMAP.md](ROADMAP.md) §1). Security/QA (master Phase 6) runs as Gate 8 before R1 launch and again for each later release. | Proposed (D-009) |
| C6 | The master prompt says "multiple price lists / wholesale tiers" in the core catalogue. PRD puts wholesale price lists in R2. | Master M1/M9 vs PRD §4 | R1 schema includes `PriceList` (with only the default retail list active), so wholesale needs no schema rewrite. Wholesale UI ships in R2. | Proposed |
| C7 | The master prompt mentions "multi-warehouse transfers when enabled" in Module 4. PRD R1 is single-warehouse. | Master vs PRD §8 | The schema is multi-warehouse capable. R1 seeds one warehouse and keeps transfers behind a disabled flag. | Proposed (D-014) |
| C8 | Master Module 10 asks for "receivables, payables and reconciliation". SRS FR-FIN-01 says R1 covers only cash/COD and purchase-cost reporting. | Master vs SRS | R1: COD settlement register, expenses, purchase cost and supplier balances as operational reports. AR/AP ledger and journals come in R2/R3. Reports are labelled "operational, not formal accounting statements". | Proposed |

None of these conflicts blocks Gate 1. Your sign-off is needed for C1, C2 and C5 before Gate 7, which is when the dashboard is built.

## 3. Gaps and ambiguities (not specified anywhere)

| Gap | Impact | Default used until decided |
|-----|--------|----------------------------|
| Store brand name, logo, domain | Header, invoices, SEO | Name comes from `BusinessSettings` / env; store name "Luxe" |
| VAT/tax policy (BD VAT 15%/7.5%/5% by goods type? inclusive or exclusive?) | Checkout totals, invoices | Tax classes modelled; default rate 0% and prices tax-inclusive until confirmed |
| Shipping zones and fees | Checkout | Proposed: "Inside Dhaka" and "Outside Dhaka" flat fees, configurable per upazila/district |
| COD fee / COD eligibility rules | Checkout | COD eligible for all BD addresses, fee 0, configurable |
| Inventory costing method | Gross-profit reports | Proposed: moving weighted average cost; COGS snapshot on order item at fulfilment (D-016) |
| Invoice number format and fiscal year | Invoices | Proposed: `INV-{FY}-{000001}`, BD fiscal year Jul–Jun (D-017) |
| Order number format | OMS | Proposed: `ORD-{YYMMDD}-{seq}`, unguessable public lookup token kept separate |
| Return/cancellation windows | Customer self-service | Configurable; default 7 days after delivery, cancel allowed before PACKED |
| Reservation expiry | Inventory | Reserved at order placement, released on cancel; unconfirmed orders auto-release after a configurable 72 h |
| Guest checkout | Checkout | Enabled by default, BD mobile number required |
| Customer dedup rule priority | CRM | Normalized BD mobile number (E.164) first, then verified email |
| Language | UI | English first, all strings localization-ready; Bangla font loaded later |
| Courier partners (Steadfast, Pathao, RedX, Paperfly…) | Courier adapters | Manual courier only; the reference sidebar shows Steadfast and "BD courier", which suggests the likely first integrations |
| SMS provider, email provider, payment gateway (bKash/Nagad/SSLCommerz) | Messaging/payments | Not configured; adapters report `UNCONFIGURED` |
| Hosting target, backup policy (RPO/RTO) | Deployment | Proposed: managed Postgres with PITR, S3-compatible storage, Node 24 runtime |
| Expected order volume | Indexing, queue sizing | Assumed < 5k orders/day for R1 |

## 4. Provider dependencies (must be contracted before "active")

Meta Business / Graph API permissions · courier merchant API keys (and webhook support) · SMS sender ID with BTRC-compliant masking · email provider (SMTP/API) · payment gateway merchant onboarding · voice/autocall provider. Each of these appears as **Unconfigured / Manual** until real credentials and passing sandbox tests exist.

## 5. Blockers for Gate 1

None. Gate 1 needs only Node ≥ 22.12 (Node 24 is available through nvm) and a local PostgreSQL (16 is installed through Homebrew).

## 6. Blockers for later gates (need business input)

- Gate 2: final role list and permission matrix sign-off (draft in [ARCHITECTURE.md](ARCHITECTURE.md) §6).
- Gate 3: tax policy, shipping fee table, COD rules, costing method.
- Gate 4: invoice and order number formats.
- Gate 6: courier and SMS provider selection with credentials.
- Gate 7: dashboard metric definitions sign-off (C1/C2).
