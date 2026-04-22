import type { BuildingEntity, RoofConfig } from '@/domain/building';
import { calculateTotalQuote, type PriceBook } from '@/domain/pricing';
import type { ConfigData } from '@/domain/config';
import type { Currency } from '@/domain/tenant';
import type { MaterialRow } from '@/domain/catalog';
import type { SupplierProductRow } from '@/domain/supplier';
import { buildSupplierProductSnapshot } from '@/domain/supplier/snapshot';
import type {
  OrderConfigSnapshot,
  OrderQuoteSnapshot,
} from './types';

interface BuildQuoteSnapshotInput {
  code: string;
  buildings: BuildingEntity[];
  roof: RoofConfig;
  priceBook: PriceBook;
  defaultHeight: number;
  currency: Currency;
  materials: MaterialRow[];
  supplierProducts?: SupplierProductRow[];
  /** Override for tests; defaults to `Date.now()`. */
  now?: () => Date;
}

const eurosToCents = (eur: number): number => Math.round(eur * 100);

/** Snapshot the priced quote in the multi-item-shaped envelope. Today
 *  every order has exactly one item; this shape lets us add a cart in
 *  the future without a schema migration. The priceBook is deep-cloned
 *  so the snapshot is immune to subsequent mutations of the source.
 *  Supplier-product line items get the full product data frozen onto
 *  them so historical orders remain re-renderable even after the product
 *  is edited or archived. */
export function buildQuoteSnapshot(input: BuildQuoteSnapshotInput): OrderQuoteSnapshot {
  const supplierProducts = input.supplierProducts ?? [];
  const { lineItems, total } = calculateTotalQuote(
    input.buildings,
    input.roof,
    input.priceBook,
    input.materials,
    input.defaultHeight,
    supplierProducts,
  );

  // Freeze full supplier-product data onto any line item that references one
  const frozenLineItems = lineItems.map((item) => {
    if (!item.source || item.source.kind !== 'supplierProduct') return item;
    const productRow = supplierProducts.find((p) => p.id === item.source!.productId);
    if (!productRow) return item;
    return { ...item, supplierProduct: buildSupplierProductSnapshot(productRow) };
  });

  const subtotalCents = eurosToCents(total);
  return {
    items: [{ code: input.code, lineItems: frozenLineItems, subtotalCents }],
    totalCents: subtotalCents,
    currency: input.currency,
    priceBook: structuredClone(input.priceBook),
    snapshotAt: (input.now?.() ?? new Date()).toISOString(),
  };
}

/** Mirror snapshot for ConfigData. Deep-cloned for the same reason. */
export function buildConfigSnapshot(code: string, config: ConfigData): OrderConfigSnapshot {
  return { items: [{ code, config: structuredClone(config) }] };
}
