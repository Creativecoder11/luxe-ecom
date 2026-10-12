# Product Requirements Document (PRD)
**Unified Multi-Category Commerce & Business Operations Platform | Version 2.0 | 11 October 2026**

## 1. Product vision
Build a configurable, Bangladesh-first, internationally extensible business solution combining a dynamic multi-category eCommerce storefront, omnichannel order management, customer relationship management (CRM), inventory, courier, communications, payments, reporting and modular ERP operations. One business may sell beauty and cosmetics, clothing, electronics, gadgets, home products and future categories without rewriting the catalogue. The initial product is a single-business / multi-channel platform, not automatically an open third-party seller marketplace.

## 2. Foundational principles and operating model
- Category-agnostic product schema with shared fields, flexible category-specific attributes, variation types, pricing, media and optional expiry/batch/serial tracking.
- Centralized back office: products, social orders, web orders, POS and wholesale orders share customer, inventory, shipment and financial records where enabled.
- Modular architecture: core commerce plus optional operations and ERP modules; disabling a module must not break order placement.
- Bangladesh-first: BDT, cash on delivery (COD), district/upazila-friendly addresses, courier connectivity and SMS readiness; country, currency and taxation configurable for later rollout.
- Separate verified integrations from planned adapters. External courier, Facebook, SMS, voice, gateway and accounting APIs require provider approvals, credentials and testing.
- Business owners and staff control data through role-based permissions, audit logs and privacy safeguards.

## 3. User groups
- Guest or registered shopper: browse, filter, cart, checkout, order status, return requests and support.
- Sales/order agent: create phone/Facebook orders, confirm and process orders, assist customers.
- Catalog and inventory operator: publish products, manage supplier purchasing, goods receipts and warehouses.
- Customer service / call-center agent: unified customer timeline, tickets, follow-up tasks and communications.
- Courier/fulfilment operator: shipment booking, exception handling, returns and COD reconciliation.
- Marketing operator: audience segments, coupon campaigns, authorized SMS messaging and storefront content.
- Accountant / finance operator: payments, invoices, receipts, payables and business reports.
- Retail/POS, wholesale, dealer and sales-representative staff: scoped access to their relevant module.
- HR and management staff: employee information, approval flows, analytics and settings as permitted.
- Platform administrator / business owner: configurable stores, integrations, permissions, business settings and logs.

## 4. Scope and phased delivery
### Release 1 — Commerce operations foundation (launch target)
- Dynamic storefront and CMS; configurable multi-category products, brands, categories, attribute definitions, variant combinations, stock/SKU, product import/export.
- Customer identity and account; search, filter, cart, wishlist, coupons, checkout, COD where eligible, order tracking and return requests.
- Unified OMS for website orders and staff-entered Facebook/phone orders; order confirmation queue, notes and status history.
- Single-warehouse inventory ledger, stock reservations, low-stock monitoring, supplier/basic purchase receiving.
- Core CRM with customer profile, order history, tags, inquiries, follow-up tasks and support tickets.
- Courier adapter framework with manual booking/tracking and at least one real integration only if credentials and provider contract are available.
- Invoice generation, COD/payment recording, essential sales and gross profit reports with clear cost assumptions; basic admin dashboard, roles and audit trail.
- Transactional messages via configurable provider; SMS/email must be labelled 'manual/test' until a provider is connected.
### Release 2 — Omnichannel and finance automation
- Authorized Facebook/Meta channel integration where allowed; campaign attribution, inbox/order capture only through permitted APIs or manual workflows.
- Multi-courier live booking/webhooks, parcel exception/missing parcel queue, return shipment tracking and carrier KPIs.
- Approved local payment gateway integrations; webhook verification, refund workflows and reconciliation.
- Bulk/promotional SMS subject to consent, opt-out and provider support; automated delivery alerts and customer call tasks; voice/autocall after legal and provider checks.
- Multiple warehouse transfers, advanced purchasing/PO and supplier management; full accounting ledger if explicitly approved.
- Smart POS, retail locations and wholesale price lists where business needs justify.
### Release 3 — Optional advanced ERP extensions
- Distribution, dealer portal, sales representative (SR) routes/commissions, wholesale credit controls.
- Production/BOM/work orders, supply chain, import/export and LC document tracking, project approval management.
- HR/employee records and relevant workflows; multi-business operation, extra storefront themes and additional localizations.
- Do not imply production, LC compliance, payroll or multi-company accounting are included in release 1.

## 5. Category-independent product and catalogue management
- Create, edit, duplicate, archive, publish, unpublish and delete products subject to retention rules.
- Hierarchical category management and custom category attributes (data type, validation, mandatory, filterable, searchable).
- Examples: clothing (size, color, material); cosmetics (shade, skin type, ingredient, batch, expiry); electronics (model, voltage, warranty, serial/IMEI where relevant).
- Simple, variant and bundled products; configurable option combinations, images, SKU, barcode, weight/dimensions, multiple price lists, tax class, purchase cost, stock policy.
- Multiple brands, collections, tags, ratings/reviews moderation and product search/filter facets.
- Digital/regulated/perishable goods require separate policy checks; do not promise unrestricted sale of every product type.
- Bulk CSV import and validation report; export permission controls; duplicate SKU detection and safe media storage.

## 6. Storefront and customer experience
- Dynamic homepage, banners, featured products, category sections, campaigns, brand pages, search, filters, product comparison if enabled, and responsive themes.
- Product detail pages with variants, stock status, return policy, delivery estimate, specifications, related items and structured SEO metadata.
- Registration/login, optional guest checkout, address book, cart, wishlist, discounts and coupons.
- Secure checkout with server-side recalculation and supported payment methods. Launch supports configurable COD; online payment is disabled until a provider is approved and integrated.
- Order list, tracking timeline, configurable cancellation/return eligibility, support requests and notification preferences.
- SEO-friendly slugs, sitemap, canonical URLs, structured data, accessibility, privacy/terms/contact pages.

## 7. Unified order management (OMS)
- Source types: Website, Facebook-manual, Phone/Call Center, POS, Wholesale/Dealer, Other (integration-driven).
- Manual social-order entry is available at launch; Facebook automatic sync is conditional on approved Meta APIs/permissions and channel-specific limitations.
- Order capture, duplicate checks, confirmation call/task, fraud/risk flags, internal notes, picking, packing, shipment and delivery statuses.
- Separate order, fulfillment, courier, payment and return statuses; immutable item/pricing/address snapshots.
- Partial fulfilment, split shipments and exchange handling can be introduced after basic lifecycle validation.
- Return/RMA workflow: request, approve/reject, parcel receipt, condition inspection, restock decision, refund/credit outcome.

## 8. Inventory, purchasing and warehouses
- Stock-on-hand, reserved, available and damaged/returned stock with an auditable movement ledger.
- Supplier database, purchase orders, receiving notes, adjustments, reorder levels and cost tracking.
- Release 1 single warehouse; multi-warehouse transfers, location-level bins and batch/expiry controls where relevant in later releases or as selected extensions.
- Avoid overselling under concurrent checkout and staff-created orders; configurable reservation expiry and cancellation release rules.

## 9. Courier and delivery operations
- Courier service adapters and provider-specific shipment mapping; manual courier assignment before live integration.
- Booking/label creation if provider supports it, airway bill/tracking ID, real-time webhook/poll status when supported, dispatch and delivery notifications.
- Missing/stuck parcel exceptions, return-to-origin (RTO), return shipments, SLA metrics and carrier success/failed-delivery rates.
- Shipping zones, fees, COD eligibility, carrier reconciliation, charge adjustments and delivery performance reporting.

## 10. CRM and customer service
- One customer record with deduplication policies across phone/email/channel identifiers; 360° profile and communication history.
- Tags/segments, lead/inquiry records, customer notes, assigned follow-ups, pipeline/status, reminders, repeat order insights and consent preferences.
- Support tickets, issue types, SLA target, internal conversation logs, escalation, templates and call center work queue.
- Call confirmation and activity logs at launch; integrated dialer/autocall depends on provider availability and permissions.

## 11. Communications and automation
- Transactional order confirmation, payment/dispatch/delivery/return notifications by connected email/SMS channel.
- Templates, language selection, event triggers, retry queues, failed-delivery handling and channel delivery logs.
- Bulk SMS/promotional campaigns require affirmative applicable consent, opt-out and sender/provider compliance.
- Automation builder later: e.g. confirmed order → shipment task → status update → customer message → follow-up reminder.

## 12. Invoices, payments, POS and commercial extensions
- Numbered digital invoices, PDF/printable receipts, order-linked records, invoice storage and adjustment/refund documents.
- COD collection due/collected/reconciled must be distinct; partial payment and ledger posting rules are configurable.
- Local online gateways only after merchant eligibility, refund rules, webhook and reconciliation validation.
- POS: barcode scan, staff/location scoping, cash register close, returns and stock synchronization (Release 2).
- Wholesale, retail, dealer, distribution and SR sales require customer-tier price lists, order limits and credit permissions (optional modules).

## 13. Accounts and finance
- Launch: cash/COD settlement register, expense and purchase-cost inputs, gross-sales/returns/discounts/net-sales metrics, estimated gross-profit report clearly labelled by costing method.
- Later: chart of accounts, journal entries, receivables/payables, bank/cash reconciliation, VAT/tax treatment, multi-branch reporting, approval and period close.
- Do not describe net profit as validated without operating expense allocation, tax policies and complete ledger implementation.

## 14. HR, production, supply chain and other ERP modules
- Optional HR: employee profiles, team, attendance/leave and approval workflows subject to privacy and local requirements.
- Optional production: BOM, work orders, raw material consumption, finished goods, cost calculations and quality status.
- Optional imports/exports: shipment documents, LC reference/document tracking, landed-cost inputs and approval workflows; not banking or customs system certification.
- Optional projects: approval chain, request history, delegated authorization and audit trail.

## 15. Dashboard and reporting
- Live metrics from actual records: order count by source/status, gross/net sales, average order value, COD outstanding/collected, inventory on hand, stock-outs, return/RTO rate and courier SLA.
- CRM reports: leads, response times, follow-up completion, repeat buyer rate, support resolution.
- Profit: sales minus recognized COGS and discounts/returns with explicit accounting methodology; do not label gross profit as net profit.
- Filters by period, channel, category, brand, location, agent and courier; permission-guarded CSV export.

## 16. Experience, configuration and integrations
- Modern, mobile-friendly admin with left navigation, KPI cards, charts, data tables, robust search, bulk actions and responsive operations views.
- The earlier electronics storefront reference remains an aesthetic reference only, not a category restriction. Theme system must accommodate beauty, apparel, gadgets and mixed-category campaigns.
- Integration settings for couriers, Meta, SMS, email, payment, accounting and POS; all have manual/fallback states and documented dependencies.
- Multi-business operations require explicit data/tenant isolation; not enabled by default in launch.

## 17. Non-functional and security requirements
- Strict server authorization and user ownership, audit trails, MFA for privileged accounts, input validation, rate limits, encrypted transport and secure secret handling.
- Secure uploads, data retention, privacy/campaign consent, backups/restore rehearsals, structured logs and alerts.
- Currency amounts in integer minor units and explicit currency, flexible address models, localization-ready content.
- WCAG-oriented accessible interactions, Core Web Vitals monitoring, scalable pagination, retry-safe integrations, cross-browser testing.

## 18. Acceptance criteria
- Admin can create cosmetics, apparel and gadget products with distinct, validated attributes/variants without schema changes.
- Admin can publish/unpublish product, manage category, stock, sale pricing and discounts; customer can order through checkout.
- A website order and a manually recorded Facebook order enter the same OMS and CRM customer timeline, without duplication.
- Stock stays consistent across concurrent order operations; inventory ledger records reason and actor.
- Eligible COD order can be confirmed, fulfilled, shipped, delivered and reconciled; courier unavailable case has manual fallback.
- Customer service can assign follow-up, open ticket and record interaction; customer data is permission-scoped.
- Invoice, sales report and category/courier dashboard reconcile to test transaction records; reports disclose definitions.
- Unconnected payment/courier/SMS/Meta services are clearly disabled or marked manual; none pretend to be active.
- Phase 2/3 module navigation is either hidden or plainly identified as not yet available.

## 19. Business decisions and dependencies
- Operating model: one business with multiple channels vs SaaS serving independent merchant tenants; first is default pending approval.
- Branding/domains, launch product categories, SKU rules, bundled goods, per-category attributes, product safety/restricted-item policies.
- Initial warehouse(s), purchase-cost method, invoicing/tax policy, COD fees, courier partners and service coverage.
- Meta Business account/API permissions; SMS/voice providers, consent copy; email provider; payment provider and merchant documentation.
- Preferred launch module subset, permission matrix, expected order volumes and migration/import sources.
