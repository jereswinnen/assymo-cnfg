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
import type { PriceBook } from '@/domain/pricing';
import type { Branding, Currency, Locale } from '@/domain/tenant';

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
