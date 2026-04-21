import type { PriceBook } from '@/domain/pricing';
import type { Branding } from './branding';
import type { EnabledMaterials } from './enabledMaterials';

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
  /** Allow-list of material slugs. `null` = unrestricted (all registry
   *  materials allowed). `[]` = explicitly nothing. Populated array =
   *  only these slugs show up in pickers. Sentinels in
   *  `ALWAYS_ENABLED_SLUGS` (currently `geen`) are added transparently
   *  by `filterCatalog` and do not need to be included. */
  enabledMaterials: EnabledMaterials;
}
