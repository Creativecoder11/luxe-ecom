# Software Requirements Specification (SRS)
**Unified Multi-Category Commerce & Business Operations Platform | Version 2.0 | 11 October 2026**

## 1. Purpose and architectural stance
Specification for a modular single-business, multi-channel commerce + CRM + operations platform with expandable ERP capabilities. 'All modules' means architecturally supported roadmap, not all completed at launch. Recommended stack preserves prior Next.js App Router / TypeScript / Tailwind / PostgreSQL / Prisma / established auth / Vitest / Playwright. Deployment and provider selections remain decisions.

## 2. Architecture and service boundaries
- Modular monolith initially; separate presentation, domain services, data access, integration adapters and background job queues.
- Domains: identity/access, tenants/business settings (tenant-ready only), catalog, pricing, inventory, purchasing, carts, OMS/fulfilment, shipping/couriers, payments/invoices, customers/CRM, helpdesk/call center, messaging, POS, wholesale/dealers/SR, accounting, HR, production, supply chain/import-export, approvals, analytics and audit.
- Outbox/event-driven integration delivery to prevent notification and webhook failures from invalidating committed orders; idempotent handlers.
- Integration adapters: Meta channel, courier providers, SMS, voice, email, payments and external accounting; ports defined even if no credentials exist.
- Data isolation by businessId only if multi-business mode is formally enabled; avoid presenting tenant-ready architecture as fully implemented SaaS.

## 3. Core multi-category data design
- Product: id, businessId, slug, title, content, brandId, status, productType (simple/variant/bundle), SEO fields, category membership, publication timestamps.
- Category: hierarchical parentId, sort, status; AttributeDefinition: code, type (text/number/date/bool/select/multi-select), validation, searchable, filterable, category scope.
- ProductAttributeValue and VariantOption/VariantOptionValue: typed fields supporting sizes, shades, colors, memory/specs, skin type etc. Validation must match category definitions.
- ProductVariant: SKU unique within business, barcode, active, price, compareAt, cost, taxClass, weight, dimensions; ProductMedia linked to product/variant.
- Optional Traceability records: batch, expiry date, lot, serial/IMEI, warranty; only required in categories configured for them.
- Product availability, market restrictions, return restrictions and compliance tags configurable by category/product.
- Avoid arbitrary client-provided attribute keys in persisted product filters without validated definitions.

## 4. Entity inventory and relationships
- User, Session, Role, Permission, StaffAssignment, Customer, CustomerAddress, CustomerIdentityChannel, CustomerConsent.
- BusinessSettings, StorefrontTheme, ContentPage, Banner, Category, Brand, Product, ProductVariant, AttributeDefinition, ProductAttributeValue, ProductMedia, PriceList, PriceRule, Coupon.
- Warehouse, BinLocation (later), StockBalance, StockMovement, StockReservation, Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceipt.
- Cart, CartItem, Order, OrderItem, OrderSource, OrderStatusHistory, Payment, PaymentTransaction, Invoice, Refund, ReturnRequest, ReturnItem.
- Shipment, ShipmentEvent, CourierProviderConfig, TrackingException, CODRemittance, CourierCharge.
- CRMLead, CustomerNote, CustomerTag, Interaction, FollowUpTask, SupportTicket, SupportMessage, CallLog.
- NotificationTemplate, MessageDispatch, Campaign, AutomationRule, ConsentLog, IntegrationCredentialReference, WebhookEvent, OutboxEvent, AuditLog.
- Later modules: POSRegister, POSShift, RetailLocation, Dealer, SalesRep, DistributionRoute, AccountingAccount, JournalEntry, AR/AP, Employee, Attendance, LeaveRequest, BOM, WorkOrder, ImportExportShipment, LCDocumentReference, ApprovalRequest.
- Use explicit owner/business relationships, foreign keys, indexes, lifecycle/retention policies and timestamps.

## 5. Role and permission model
- Deny by default; business owner, store admin, catalog manager, order agent, courier operator, CRM agent, marketing manager, finance officer, accountant, HR manager, POS cashier, sales representative.
- Permission verbs per module include view/create/update/delete/archive/export/approve/refund/reconcile and sensitive PII access.
- Scope by business, branch, assigned order/lead, warehouse or team where configured; permission checks in service layer and tests for prohibited access.
- Privileged writes and customer contact access produce audit records; admin MFA recommended.

## 6. Functional requirements — commerce and OMS
- FR-CAT-01: configurable category tree; typed attributes; products and SKU variants; bulk import with errors, media upload validation and publish states.
- FR-CAT-02: cross-category catalogue, query/search, filters, pagination and category-specific facets; show only permitted published products.
- FR-COM-01: cart, wishlist, discounts, customer account, address and checkout with backend authoritative pricing/stock/tax/shipping calculations.
- FR-ORD-01: support WEBSITE, FACEBOOK_MANUAL, PHONE, POS, WHOLESALE and OTHER channel source enumeration; no automatic Meta ingestion until integration approved.
- FR-ORD-02: order create atomic and idempotent; snapshots of items, prices, taxes, shipping, contact and address; unique order numbers and audit history.
- FR-ORD-03: confirmation tasks, internal notes, validation of status transitions, pick-pack-dispatch-deliver, returns and exchanges.
- FR-PAY-01: eligible COD orders initially UNPAID/COLLECT_ON_DELIVERY, update collection and reconciliation separately from delivery; gateway adapter feature-flagged until tested.
- FR-INV-01: stock movement ledger, reservations, adjustment reasons, low-stock; prevent overselling for simultaneous website and manual orders.
- FR-PUR-01: supplier, purchase order and goods receipt update stock with source references.

## 7. Functional requirements — CRM, logistics and communication
- FR-CRM-01: customer identity resolution/dedup by verified normalized phone/email/channel IDs; tags, lead stages, account timeline and assignments.
- FR-CRM-02: support ticket, follow-up task, notes, call logs, service status and SLA fields; control access to sensitive interactions.
- FR-CUR-01: manual shipment booking and tracking fields at launch; adapter interface for live carrier booking, labels, events, cancellations and RTO where carrier supports them.
- FR-CUR-02: missing/stuck shipments, return parcel statuses, courier success rate, cash remittance/charges and exception alerts.
- FR-MSG-01: event-based transactional message templates, retry states, opt-out preferences and provider-delivery log; queue processing idempotent.
- FR-MSG-02: campaign bulk SMS and autocalls disabled until verified consent, approved sender/voice provider and applicable compliance review.

## 8. Functional requirements — invoicing, finance and extensions
- FR-INVOC-01: sequential invoice identifiers scoped appropriately, printable/PDF copies, credit notes/refund references, durable order references.
- FR-REP-01: sales, orders, stock, categories, channel, courier, CRM and gross margin reports with published metric definitions and authorized export.
- FR-FIN-01: launch cash/COD and purchase-cost reporting only; ledger-based profit/loss, journal posting, AR/AP and reconciliation are advanced scope unless separately approved.
- FR-POS-01: future retail POS with offline policy decision, cashier shifts and centralized stock/order posting.
- FR-WHO-01: future price lists, quotes, dealer accounts, SR assignments, distribution management and credit controls.
- FR-ERP-01: optional production/BOM/work orders; LC document references/import/export workflows; supply chain; HR/employee; project approvals with individual acceptance tests.

## 9. Lifecycle models
- Order: DRAFT (staff only) → PENDING_CONFIRMATION → CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED, plus CANCELLED, DELIVERY_FAILED, RETURN_REQUESTED, RETURN_APPROVED, RETURNED, PARTIALLY_RETURNED. Validate non-linear carrier-specific paths.
- Shipment state independent from order: NOT_BOOKED, BOOKED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RTO_INITIATED, RETURNED_TO_ORIGIN, EXCEPTION.
- Payment: COD_UNPAID, COD_COLLECTION_PENDING, COD_COLLECTED, REMITTED, FAILED_COLLECTION; future gateway INITIATED/PENDING/PAID/FAILED/REFUNDED based only on verified provider events.
- CRM lead: NEW, CONTACTED, QUALIFIED, WON, LOST; task: OPEN, IN_PROGRESS, COMPLETED, CANCELLED.
- Inventory: balances computed consistently from audited movements; reservations released on cancellation/expiry; returns require condition check before restock.

## 10. Integration contracts
- Each external adapter defines provider identifier, business credential configuration, supported capabilities, request timeout, retry policy, rate limits, idempotency key and secret-secure webhook verification.
- Manual fallback whenever channel/provider is unsupported. Never advertise 'real time' where provider lacks webhooks or polling access.
- Meta automated order capture and messaging depend on specific approved APIs, access scopes and platform rules; manual Facebook source input is separate.
- Invoice and data exports must not reveal unauthorized customer PII; protect CSV against spreadsheet formula injection.

## 11. Routes and surfaces
- Storefront: /, /shop, /categories/[slug], /products/[slug], /search, /cart, /checkout, /pages/[slug].
- Customer: /account, /account/orders, /account/wishlist, /account/returns, /account/support, /account/addresses.
- Admin: /admin, /admin/catalog/products, /admin/catalog/categories, /admin/catalog/attributes, /admin/orders, /admin/omnichannel, /admin/inventory, /admin/purchasing, /admin/couriers, /admin/crm, /admin/support, /admin/messages, /admin/invoices, /admin/payments, /admin/reports, /admin/settings, /admin/staff, /admin/audit-logs.
- Optional modules (feature-gated): /admin/pos, /admin/wholesale, /admin/dealers, /admin/sales-reps, /admin/accounts, /admin/hr, /admin/production, /admin/import-export, /admin/approvals.

## 12. Non-functional requirements and security
- Secure session, CSRF protection where relevant, XSS and upload validation, ownership and IDOR/BOLA tests, field-level PII restrictions and immutable financial event logs.
- HTTPS/TLS; secret manager; encrypted credential handling; idempotency and durable outbox; audit actor, reason and correlation IDs.
- Use integer minor monetary units and currency ISO codes; tax/FX policies explicit; no raw card numbers or CVV.
- Database index for businessId, SKU, category, status, order number, customer, warehouse, source, timestamp and carrier tracking.
- Maintain backups/restore, CI checks, staging, release/rollback, structured logging, core performance monitoring, accessibility and localized responsive designs.

## 13. Test and verification matrix
- Catalogue: cosmetic shade, clothing size/color, gadget technical attributes; validation and filters; duplicate SKU/bulk import rejects.
- OMS: website + manual Facebook order same order queue; duplicate prevention; staff roles; allowed status transitions and customer timeline.
- Stock: purchase receive, reserve, cancel, return restock decision; race between online and manual orders does not oversell.
- Courier: manual booking, provider timeout, duplicate callback, delivery failure, missing parcel and RTO.
- CRM: deduplication rules, case access, follow-up assignment, call interaction and consent preferences.
- Payment/invoice: COD amount collection differs from delivered state; immutable invoice number; order and amount reconciliation.
- Reports: channel/category/courier/CRM metrics computed from fixtures; permission-protected CSV exports.
- Security: denied cross-customer/cross-business access, failed provider credentials, webhook spoof, SMS opt-out, audit logs and sensitive export restrictions.
- Release: actual typecheck, lint, unit/integration/E2E test results and restore drill; never mark unrun tests as passed.

## 14. Configuration/open decisions
- Single business vs tenant SaaS; release-level feature flags and pricing/licensing model.
- Product variant attribute UX, category defaults, regulated products, marketplace vs owned-stock strategy.
- Initial courier partner contract/API, shipment fee/return tariffs and COD collection policy.
- Order volume, warehouse setup, valuation/COGS accounting methods, taxation and local invoice/legal rules.
- Meta/communication permissions and provider selections; any integrations lacking approval remain stubbed/manual.
- Store identity, localization, supported countries, online gateway launch decision and module rollout priorities.

## 15. Definition of done
Every module must have accepted requirements, secure authorization, validated workflows, documented schemas and API contracts, migration tests, useful error/loading states and actual passing checks. A feature gate must remain off for absent provider credentials or unapproved Release 2/3 integrations.
