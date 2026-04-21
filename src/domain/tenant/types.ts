import type { PriceBook } from '@/domain/pricing';
import type { Branding } from './branding';

/** Tenant-scoped configuration injected into every domain function that
 *  depends on brand, locale, or catalog decisions. Anything that varies
 *  per brand belongs here, not in module-scope constants. */
export type TenantId = string;

export type Locale = 'nl' | 'fr' | 'en';
export type Currency = 'EUR';

export interface TenantContext {
  id: TenantId;
  displayName: string;
  locale: Locale;
  currency: Currency;
  priceBook: PriceBook;
  branding: Branding;
}
