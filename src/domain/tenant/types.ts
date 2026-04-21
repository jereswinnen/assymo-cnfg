import type { MaterialRow } from '@/domain/catalog';
import type { PriceBook } from '@/domain/pricing';
import type { Branding } from './branding';
import type { TenantInvoicing } from './invoicing';

export type TenantId = string;
export type Locale = 'nl' | 'fr' | 'en';
export type Currency = 'EUR';

/** Tenant-scoped context injected into every layout + API route.
 *  Anything that varies per brand belongs here, not in module-scope
 *  constants. `catalog.materials` is the full DB-backed material list
 *  for this tenant, fetched alongside the tenant row and cached per
 *  request. Phase 5.5.2 will add `products` under `catalog`. */
export interface TenantContext {
  id: TenantId;
  displayName: string;
  locale: Locale;
  currency: Currency;
  priceBook: PriceBook;
  branding: Branding;
  invoicing: TenantInvoicing;
  catalog: {
    materials: MaterialRow[];
  };
}
