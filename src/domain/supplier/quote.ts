import type { ResolvedWindowControls } from '@/domain/openings';
import type { SupplierProductRow } from './types';

export interface SupplierLineItem {
  labelKey: string;
  labelParams: Record<string, string | number>;
  total: number;
  source: {
    kind: 'supplierProduct';
    productId: string;
    sku: string;
  };
}

function findActive(
  productId: string,
  products: readonly SupplierProductRow[],
): SupplierProductRow | undefined {
  return products.find((p) => p.id === productId && p.archivedAt === null);
}

export function getSupplierDoorLineItem(
  productId: string,
  products: readonly SupplierProductRow[],
): SupplierLineItem | null {
  const product = findActive(productId, products);
  if (!product) {
    return {
      labelKey: 'quote.line.supplierMissing',
      labelParams: { id: productId, kind: 'door' },
      total: 0,
      source: { kind: 'supplierProduct', productId, sku: '' },
    };
  }
  return {
    labelKey: 'quote.line.supplierDoor',
    labelParams: { name: product.name, sku: product.sku },
    total: product.priceCents / 100,
    source: { kind: 'supplierProduct', productId, sku: product.sku },
  };
}

export function getSupplierWindowLineItem(
  productId: string,
  products: readonly SupplierProductRow[],
  controls: ResolvedWindowControls,
): SupplierLineItem | null {
  const product = findActive(productId, products);
  if (!product) {
    return {
      labelKey: 'quote.line.supplierMissing',
      labelParams: { id: productId, kind: 'window' },
      total: 0,
      source: { kind: 'supplierProduct', productId, sku: '' },
    };
  }
  let totalCents = product.priceCents;
  if (controls.segments.count > 0 && controls.segments.surchargeCentsPerDivider > 0) {
    totalCents += controls.segments.count * controls.segments.surchargeCentsPerDivider;
  }
  if (controls.schuifraam.enabled && controls.schuifraam.surchargeCents > 0) {
    totalCents += controls.schuifraam.surchargeCents;
  }
  return {
    labelKey: 'quote.line.supplierWindow',
    labelParams: { name: product.name, sku: product.sku },
    total: totalCents / 100,
    source: { kind: 'supplierProduct', productId, sku: product.sku },
  };
}
