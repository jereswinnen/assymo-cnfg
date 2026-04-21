import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { ConfigData } from '@/domain/config';
import type {
  OrderConfigSnapshot,
  OrderQuoteSnapshot,
  OrderStatus,
} from '@/domain/orders';
import type {
  InvoicePaymentMethod,
  InvoiceSupplierSnapshot,
} from '@/domain/invoicing';
import type { PriceBook } from '@/domain/pricing';
import type { Branding, Currency, Locale, TenantInvoicing } from '@/domain/tenant';

/** Tenants — one row per white-label brand. Columns mirror the in-memory
 *  TenantContext. `id` is the stable slug used everywhere (URL lookup,
 *  foreign keys). Future columns land here instead of new tables. */
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  locale: text('locale').$type<Locale>().notNull(),
  currency: text('currency').$type<Currency>().notNull(),
  priceBook: jsonb('price_book').$type<PriceBook>().notNull(),
  branding: jsonb('branding').$type<Branding>().notNull(),
  /** Allow-list of material slugs. `null` = unrestricted. See `@/domain/tenant` → `validateEnabledMaterialsPatch` and `ALWAYS_ENABLED_SLUGS`. */
  enabledMaterials: text('enabled_materials').array(),
  /** Per-tenant invoicing defaults. See `@/domain/tenant` →
   *  `TenantInvoicing` + `validateInvoicingPatch`. NOT NULL; seeded
   *  with `DEFAULT_ASSYMO_INVOICING`. */
  invoicing: jsonb('invoicing').$type<TenantInvoicing>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Saved configurator scenes. Every configuration a user saves, shares, or
 *  submits as part of an order lands here. `code` is the base58 share
 *  code (what lives in URLs); `data` is the canonical JSON we serve back
 *  and price. `version` mirrors CONFIG_VERSION at save time so we know
 *  which migrator to apply on read. */
export const configs = pgTable(
  'configs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id).notNull(),
    code: text('code').notNull(),
    data: jsonb('data').$type<ConfigData>().notNull(),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('configs_tenant_code_idx').on(t.tenantId, t.code)],
);

/** Hosts that resolve to a given tenant — exact match (`assymo.be`),
 *  dev fallback (`localhost`, `localhost:3000`), or subdomain shorthand
 *  (`partner` matching `partner.configurator.com`). All stored lowercase;
 *  callers normalize before lookup. */
export const tenantHosts = pgTable(
  'tenant_hosts',
  {
    hostname: text('hostname').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('tenant_hosts_tenant_id_idx').on(t.tenantId)],
);

/** Customer orders. Each row freezes the priced quote (`quoteSnapshot`)
 *  and the ConfigData (`configSnapshot`) at submit time so the order is
 *  re-renderable years later regardless of price-book or migration drift.
 *  `customerId` is nullable until the client claims the magic link;
 *  `configId` is nullable so an order is preserved even if a config row
 *  is later GC'd. `code` is the base58 share code — the same value lives
 *  inside `quoteSnapshot.items[*].code`, denormalized to the row for
 *  cheap list-view filtering. */
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'restrict' })
      .notNull(),
    configId: text('config_id').references(() => configs.id, { onDelete: 'set null' }),
    code: text('code').notNull(),
    customerId: text('customer_id'),
    contactEmail: text('contact_email').notNull(),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone'),
    notes: text('notes'),
    status: text('status').$type<OrderStatus>().notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    quoteSnapshot: jsonb('quote_snapshot').$type<OrderQuoteSnapshot>().notNull(),
    configSnapshot: jsonb('config_snapshot').$type<OrderConfigSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    index('orders_tenant_id_idx').on(t.tenantId),
    index('orders_customer_id_idx').on(t.customerId),
    index('orders_status_idx').on(t.status),
  ],
);

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenantRow = typeof tenants.$inferInsert;
export type ConfigRow = typeof configs.$inferSelect;
export type NewConfigRow = typeof configs.$inferInsert;
export type TenantHostRow = typeof tenantHosts.$inferSelect;
export type NewTenantHostRow = typeof tenantHosts.$inferInsert;
export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;

/** Per-tenant per-year invoice sequence counter. One row per tenant
 *  carrying the current tracked year and last-issued sequence. Atomic
 *  upsert on insert (see src/app/api/admin/orders/[id]/invoice/route.ts)
 *  handles first-invoice, same-year increment, and new-year reset. */
export const invoiceNumbers = pgTable('invoice_numbers', {
  tenantId: text('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  year: integer('year').notNull(),
  lastSeq: integer('last_seq').notNull(),
});

/** Issued invoices. 1:1 with an order (orderId UNIQUE).
 *  `supplierSnapshot` and the VAT fields are frozen at issue time and
 *  MUST NOT be mutated afterwards — invoices are legally immutable. */
export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'restrict' })
      .notNull(),
    orderId: text('order_id')
      .references(() => orders.id, { onDelete: 'restrict' })
      .notNull(),
    number: text('number').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    customerAddress: text('customer_address').notNull(),
    customerName: text('customer_name').notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    vatRate: text('vat_rate').notNull(),
    vatCents: integer('vat_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    supplierSnapshot: jsonb('supplier_snapshot').$type<InvoiceSupplierSnapshot>().notNull(),
    pdfUrl: text('pdf_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invoices_order_id_idx').on(t.orderId),
    uniqueIndex('invoices_tenant_number_idx').on(t.tenantId, t.number),
    index('invoices_tenant_id_idx').on(t.tenantId),
  ],
);

/** Payments recorded against an invoice. Sum(amountCents) derives the
 *  payment status (see `@/domain/invoicing` → derivePaymentStatus).
 *  `method` is currently limited to 'manual' at the API layer; the
 *  column+enum are wider so Phase 6 (Mollie / Stripe) lands migration-free. */
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .references(() => invoices.id, { onDelete: 'restrict' })
      .notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').$type<Currency>().notNull(),
    method: text('method').$type<InvoicePaymentMethod>().notNull(),
    providerRef: text('provider_ref'),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('payments_invoice_id_idx').on(t.invoiceId)],
);

export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type InvoiceNumberRow = typeof invoiceNumbers.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
