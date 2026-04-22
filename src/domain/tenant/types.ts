import type { MaterialRow, ProductRow } from '@/domain/catalog';
import type { PriceBook } from '@/domain/pricing';
import type { SupplierRow, SupplierProductRow } from '@/domain/supplier';
import type { Branding } from './branding';
import type { TenantInvoicing } from './invoicing';

export type TenantId = string;
export type Locale = 'nl' | 'fr' | 'en';
export type Currency = 'EUR';

/** Tenant-scoped context injected into every layout + API route.
 *  Anything that varies per brand belongs here, not in module-scope
 *  constants. `catalog.materials` is the full DB-backed material list
 *  for this tenant, fetched alongside the tenant row and cached per
 *  request. `supplierCatalog.{suppliers, products}` are the non-archived
 *  supplier rows and supplier-product rows for doors/windows (Phase 5.7);
 *  archived filtering mirrors `catalog.*` (server excludes archived rows
 *  before they reach the context). */
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
    products: ProductRow[];
  };
  supplierCatalog: {
    suppliers: SupplierRow[];
    products: SupplierProductRow[];
  };
}
