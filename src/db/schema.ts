import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { ConfigData } from '@/domain/config';
import type { PriceBook } from '@/domain/pricing';
import type { Currency, Locale } from '@/domain/tenant';

/** Tenants — one row per white-label brand. Columns mirror the in-memory
 *  TenantContext. `id` is the stable slug used everywhere (URL lookup,
 *  foreign keys). Future columns land here instead of new tables. */
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  locale: text('locale').$type<Locale>().notNull(),
  currency: text('currency').$type<Currency>().notNull(),
  priceBook: jsonb('price_book').$type<PriceBook>().notNull(),
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

export type TenantRow = typeof tenants.$inferSelect;
export type NewTenantRow = typeof tenants.$inferInsert;
export type ConfigRow = typeof configs.$inferSelect;
export type NewConfigRow = typeof configs.$inferInsert;
