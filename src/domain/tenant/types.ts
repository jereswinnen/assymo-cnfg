/** Tenant-scoped configuration injected into every domain function that
 *  depends on brand, locale, or catalog decisions. Grows across the
 *  extraction phases:
 *    - Step 0 (this file): identity, locale, currency, display name.
 *    - Step 1: priceBook.
 *    - Step 2: materialCatalog, productTypes.
 *    - Later: theme, copy overrides, checkout config.
 *
 *  Anything that varies per brand belongs here, not in module-scope
 *  constants. */
export type TenantId = string;

export type Locale = 'nl' | 'fr' | 'en';
export type Currency = 'EUR';

export interface TenantContext {
  id: TenantId;
  displayName: string;
  locale: Locale;
  currency: Currency;
}
